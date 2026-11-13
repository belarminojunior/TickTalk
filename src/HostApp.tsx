import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { loadMuted, setMuted } from './audio/sfx';
import { ReplacedNotice } from './components/ReplacedNotice';
import { useConfig } from './config';
import { CARDS } from './data/cards';
import { DEFAULT_SETTINGS, createInitialState, gameReducer } from './game/reducer';
import { tableView } from './game/selectors';
import { gameDrafts, parsePlayers, teamIdAt, toTeamSetup, type TeamDraft } from './game/setup';
import { clearSavedGame, loadGame, loadSetup, saveGame, saveSetup } from './game/storage';
import type { GameState, Settings } from './game/types';
import { useInterval } from './hooks/useTimer';
import { useHostLink, type LobbySetup } from './hooks/useTransport';
import type { TeamEdit } from './net/protocol';
import { usePhoneUrl } from './hooks/usePhoneUrl';
import { I18nProvider } from './i18n';
import { STRINGS } from './i18n/strings';
import { SetupScreen } from './screens/SetupScreen';
import { TableScreen } from './screens/TableScreen';

/** Two groups to start with ("Grupo A", "Grupo B"): the PC never names teams. */
const DEFAULT_TEAMS: TeamDraft[] = [
  { name: '', color: 'red', players: '' },
  { name: '', color: 'green', players: '' },
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
    turn?.settled,
    turn?.describer,
  ]);
}

/** The table (host): setup, game state and the link to the phones. */
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

  // A phone per team or per person: before the game, the phones name their team (and, one
  // phone per team, write who plays).
  const onTeamEdit = useCallback((teamId: string, edit: TeamEdit) => {
    setTeamDrafts((teams) =>
      teams.map((team, i) =>
        teamIdAt(i) === teamId ? { ...team, name: edit.name, ...(edit.players ? { players: edit.players.join(', ') } : {}) } : team,
      ),
    );
  }, []);

  // The phones see the setup rows, with the names shown on the table.
  const lobby = useMemo<LobbySetup>(
    () => ({
      teams: teamDrafts.map((d, i) => ({
        name: d.name.trim() || STRINGS[uiLanguage].groupLabel(i),
        chosenName: d.name.trim(),
        color: d.color,
        players: parsePlayers(d.players),
      })),
      language: uiLanguage,
      onTeamEdit,
    }),
    [teamDrafts, uiLanguage, onTeamEdit],
  );
  const link = useHostLink(mode, state, dispatch, config.now, config.createHostTransport, lobby);
  const phoneUrl = usePhoneUrl(true, link.room);

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

  // The setup survives a reload of the table (people may already be joining from their phones).
  useEffect(() => {
    if (inSetup) saveSetup({ settings: draft, teams: teamDrafts });
  }, [inSetup, draft, teamDrafts]);


  const start = () => {
    saveSetup({ settings: draft, teams: teamDrafts });
    dispatch({
      type: 'SETUP',
      settings: draft,
      // Teams without a name are "Grupo A", "Grupo B"…
      teams: gameDrafts(draft.screenMode, teamDrafts, link.roster, STRINGS[draft.uiLanguage].personLabel).map((d, i) =>
        toTeamSetup(d, STRINGS[draft.uiLanguage].groupLabel(i)),
      ),
      // Every game uses the whole deck (all packs).
      cards: CARDS[draft.language],
      seed: config.seed(),
    });
  };

  // With one phone per team, each group's phone writes its players: start from empty lists.
  const changeSettings = (next: Settings) => {
    if (next.screenMode === 'teamPhones' && draft.screenMode !== 'teamPhones') {
      setTeamDrafts((teams) => teams.map((team) => ({ ...team, players: '' })));
    }
    setDraft(next);
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

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  return (
    <I18nProvider language={uiLanguage}>
      {inSetup ? (
        <SetupScreen
          settings={draft}
          onSettings={changeSettings}
          teams={teamDrafts}
          onTeams={setTeamDrafts}
          link={link}
          phoneUrl={phoneUrl}
          hasSaved={!!saved}
          onContinue={continueSaved}
          onStart={start}
        />
      ) : (
        <TableScreen
          view={tableView(state)}
          dispatch={dispatch}
          link={link}
          mode={mode}
          phoneUrl={phoneUrl}
          now={config.now}
          animationScale={config.animationScale}
          muted={muted}
          onToggleMute={toggleMute}
          onNewSetup={newSetup}
          onPlayAgain={() => dispatch({ type: 'REMATCH', seed: config.seed() })}
        />
      )}
      {link.replaced && <ReplacedNotice role="host" onTakeOver={link.takeOver} />}
    </I18nProvider>
  );
}
