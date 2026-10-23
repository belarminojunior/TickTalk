import os from 'node:os';

const VIRTUAL = /(vEthernet|WSL|Hyper-V|VirtualBox|VMware|Loopback|docker|br-|veth|utun|tailscale|ZeroTier|Bluetooth)/i;

function isPrivate(ip: string): boolean {
  return /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

/** The PC's local IPv4 addresses, most likely first (Wi-Fi/Ethernet, 192.168.x). */
export function lanAddresses(): string[] {
  const found: { ip: string; score: number }[] = [];
  for (const [name, infos] of Object.entries(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      const family = String(info.family as unknown) === '4' ? 'IPv4' : String(info.family);
      if (family !== 'IPv4' || info.internal) continue;
      if (info.address.startsWith('169.254.')) continue;
      let score = 0;
      if (isPrivate(info.address)) score += 4;
      if (info.address.startsWith('192.168.')) score += 2;
      if (/(wi-?fi|wlan|wireless|ethernet|^en|^eth)/i.test(name)) score += 2;
      if (VIRTUAL.test(name)) score -= 6;
      found.push({ ip: info.address, score });
    }
  }
  return found.sort((a, b) => b.score - a.score).map((x) => x.ip);
}
