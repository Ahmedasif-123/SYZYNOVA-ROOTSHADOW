import type { ProbeInputs, ProbeResult } from "../src/lib/probeVerification";
export declare const blankProbeInputs: ProbeInputs;
export declare function normalizeProbeInputs(value: unknown): ProbeInputs | null;
export declare function evaluateProbe(inputs: ProbeInputs): ProbeResult;
