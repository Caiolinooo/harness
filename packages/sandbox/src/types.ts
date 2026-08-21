export type IsolationLevel = 1 | 2 | 3;

export interface SandboxExecRequest {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface SandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface SandboxProvider {
  readonly name: string;
  readonly level: IsolationLevel;
  isAvailable(): Promise<boolean>;
  exec(req: SandboxExecRequest): Promise<SandboxExecResult>;
  destroy(): Promise<void>;
}

export interface NetworkPolicy {
  /** Block RFC1918 / private subnets (default-deny private). */
  denyPrivateSubnets: boolean;
  allowHosts: string[];
}
