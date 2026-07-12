// ============================================================
// Device Fingerprint — identifies hardware uniquely
// Uses systeminformation to gather stable hardware IDs
// ============================================================

import si from 'systeminformation';
import crypto from 'crypto';
import os from 'os';

export interface DeviceInfo {
  fingerprint: string;       // SHA-256 hex hash
  deviceName: string;
  rawComponents: {
    uuid: string;
    cpuId: string;
    diskSerial: string;
    hostname: string;
  };
}

export async function getDeviceFingerprint(): Promise<DeviceInfo> {
  const timeout = <T>(p: Promise<T>, fallback: T, ms = 4000): Promise<T> =>
    Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);

  try {
    const [system, cpu, disks] = await Promise.all([
      timeout(si.system(), { uuid: 'unknown-uuid' } as any),
      timeout(si.cpu(), { manufacturer: 'unknown', brand: 'unknown', cores: 0 } as any),
      timeout(si.diskLayout(), [] as any[]),
    ]);

    const uuid = system.uuid || 'unknown-uuid';
    const cpuId = `${cpu.manufacturer}-${cpu.brand}-${cpu.cores}`;
    const diskSerial = disks.length > 0 ? (disks[0].serialNum || 'no-serial') : 'no-disk';
    const hostname = os.hostname();

    const raw = `${uuid}|${cpuId}|${diskSerial}|${hostname}`;
    const fingerprint = crypto.createHash('sha256').update(raw).digest('hex');

    return {
      fingerprint,
      deviceName: `${hostname} (${os.platform()} ${os.arch()})`,
      rawComponents: { uuid, cpuId, diskSerial, hostname },
    };
  } catch (err) {
    // Fallback: use available info only
    const hostname = os.hostname();
    const cpus = os.cpus();
    const fallbackRaw = `${hostname}|${cpus[0]?.model || 'unknown'}|${os.totalmem()}`;
    const fingerprint = crypto.createHash('sha256').update(fallbackRaw).digest('hex');

    return {
      fingerprint,
      deviceName: hostname,
      rawComponents: { uuid: 'fallback', cpuId: cpus[0]?.model || 'unknown', diskSerial: 'unknown', hostname },
    };
  }
}
