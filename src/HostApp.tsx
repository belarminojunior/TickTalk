import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { loadMuted, setMuted } from './audio/sfx';
import { SwapIcon } from './components/Icons';
import { ReplacedNotice } from './components/ReplacedNotice';
import { useConfig } from './config';
import { CARDS } from './data/cards';
import { filterCards } from './game/deck';
import { DEFAULT_SETTINGS, createInitialState, gameReducer } from './game/reducer';
import { tableView } from './game/selectors';
import { toTeamSetup, type TeamDraft } from './game/setup';
import { clearSavedGame, loadGame, loadSetup, saveGame, saveSetup } from './game/storage';
import type { GameState, Settings } from './game/types';
import { useInterval } from './hooks/useTimer';
import { useDescriberClient, useHostLink, commandToAction } from './hooks/useTransport';
import { usePhoneUrl } from './hooks/usePhoneUrl';
import { I18nProvider, useT } from './i18n';
import type { DescriberCommand } from './net/protocol';
import { DescriberScreen } from './screens/DescriberScreen';
import { SetupScreen } from './screens/SetupScreen';
import { TableScreen } from './screens/TableScreen';

const DEFAULT_TEAMS: TeamDraft[] = [
  { name: 'Os Leões', color: 'red', players: '' },
  { name: 'As Gazelas', color: 'green', players: '' },
];

/** What matters for saving (not the timer, which changes 5 times a second). */
function saveKey(state: GameState): string {
  const { turn } = state;
  return JSON.stringify([
    state.phase,
    state.currentTeam,
    state.round,
    state.teams.map((t) => t.position),
    turn?.ready,
    turn?.marked,
    turn?.annulled,
    turn?.die,
    turn?.settled,
    turn?.describer,
  ]);
}

const SINGLE_SCREEN_DESCRIBER_PHASES = ['handoff', 'describing', 'paused'];

/** The table (host): setup, game state and the link to the describer screen. */
export function HostApp() {
  const config = useConfig();
  const [initialSetup] = useState(loadSetup);
  const [draft, setDraft] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...initialSetup?.settings }));
  const [teamDrafts, setTeamDrafts] = useState<TeamDraft[]>(() => initialSetup?.teams ?? DEFAULT_TEAMS);
  const [state, dispatch] = useReducer(gameReducer, draft, createInitialState);
  const [saved, setSaved] = useState(loadGame);
  const [muted, setMutedState] = useState(loadMuted);

  const inSetup = state.phase === 'setup';
  const mode = inSetup ? draft.screenMode : state.settings.screenMode;
  const uiLanguage = inSetup ? draft.uiLanguage : state.settings.uiLanguage ?? 'pt';

  const link = useHostLink(mode, state, dispatch, config.now);
  const local = useDescriberClient(link.localClient, config.now);
  const phoneUrl = usePhoneUrl(mode === 'phone' || mode === 'teamPhones');

  // The host clock: time only runs here.
  useInterval(() => dispatch({ type: 'TICK', now: config.now() }), 200, state.phase === 'describing');

  // Save to localStorage on every relevant change.
  const stateRef = useRef(state);
  stateRef.current = state;
  const key = saveKey(state);
  useEffect(() => {
    const s = stateRef.current;
    if (s.phase === 'setup') return;
    if (s.phase === 'won') clearSavedGame();
    else saveGame(s);
  }, [key]);

  useEffect(() => {
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

  const cardCount = useMemo(() => filterCards(CARDS[draft.language], draft.packs).length, [draft.language, draft.packs]);

  const start = () => {
    saveSetup({ settings: draft, teams: teamDrafts });
    dispatch({
      type: 'SETUP',
      settings: draft,
      teams: teamDrafts.map(toTeamSetup),
      cards: filterCards(CARDS[draft.language], draft.packs),
      seed: config.seed(),
    });
  };

  const continueSaved = () => {
    if (!saved) return;
    setDraft({ ...DEFAULT_SETTINGS, ...saved.state.settings });
    dispatch({ type: 'LOAD', state: saved.state });
  };

  /** Back to setup. Mid-game, the game stays saved so it can be resumed later. */
  const newSetup = () => {
    if (state.phase === 'won') {
      clearSavedGame();
      setSaved(null);
    } else {
      saveGame(state);
      setSaved(loadGame());
    }
    dispatch({ type: 'RESET' });
  };

  const openDescriberWindow = useCallback(() => {
    window.open('/explicar?via=window', 'ticktalk-explicar', 'popup=yes,width=760,height=1000');
  }, []);

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const sendLocal = useCallback(
    (command: DescriberCommand) => {
      if (link.localClient) local.send(command);
      else dispatch(commandToAction(command, config.now()));
    },
    [link.localClient, local, config],
  );

  let content: JSX.Element;
  if (inSetup) {
    content = (
      <SetupScreen
        settings={draft}
        onSettings={setDraft}
        teams={teamDrafts}
        onTeams={setTeamDrafts}
        link={link}
        phoneUrl={phoneUrl}
        cardCount={cardCount}
        hasSaved={!!saved}
        onContinue={continueSaved}
        onStart={start}
        onOpenDescriberWindow={openDescriberWindow}
      />
    );
  } else if (mode === 'single' && SINGLE_SCREEN_DESCRIBER_PHASES.includes(state.phase)) {
    content = (
      <DescriberScreen
        view={local.view}
        anchor={local.anchor}
        status={local.view ? 'ready' : 'connecting'}
        mode="single"
        now={config.now}
        onCommand={sendLocal}
        handoffExtra={<SkipDescriberButton onClick={() => dispatch({ type: 'HANDOFF', skipDescriber: true })} />}
        onExit={newSetup}
      />
    );
  } else {
    content = (
      <TableScreen
        view={tableView(state)}
        dispatch={dispatch}
        link={link}
        mode={mode}
        phoneUrl={phoneUrl}
        now={config.now}
        rng={config.rng}
        animationScale={config.animationScale}
        muted={muted}
        onToggleMute={toggleMute}
        onOpenDescriberWindow={openDescriberWindow}
        onNewSetup={newSetup}
        onPlayAgain={() => dispatch({ type: 'REMATCH', seed: config.seed() })}
      />
    );
  }

  return (
    <I18nProvider language={uiLanguage}>
      {content}
      {link.replaced && <ReplacedNotice role="host" onTakeOver={link.takeOver} />}
    </I18nProvider>
  );
}

function SkipDescriberButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" className="btn btn-outline btn-lg" onClick={onClick}>
      <SwapIcon size={18} /> {t.skipDescriber}
    </button>
  );
}
