/**
 * How devices find a way to each other (WebRTC ICE servers).
 *
 * STUN lets most phones connect directly, even across networks. Some networks (mobile data
 * behind carrier NAT, office Wi-Fi) only allow a relayed connection: that needs a TURN
 * server. There is no free TURN without an account, so it is optional and set at build time:
 *   VITE_TURN_URLS=turn:relay.example.com:3478,turns:relay.example.com:443?transport=tcp
 *   VITE_TURN_USERNAME=...
 *   VITE_TURN_CREDENTIAL=...
 */
export interface IceEnv {
  VITE_TURN_URLS?: string;
  VITE_TURN_USERNAME?: string;
  VITE_TURN_CREDENTIAL?: string;
}

const STUN: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export function iceServers(env: IceEnv = import.meta.env as IceEnv): RTCIceServer[] {
  const urls = (env.VITE_TURN_URLS ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter((u) => /^turns?:/.test(u));
  if (urls.length === 0) return STUN;
  return [...STUN, { urls, username: env.VITE_TURN_USERNAME ?? '', credential: env.VITE_TURN_CREDENTIAL ?? '' }];
}
