# Benchmark Notes

This document records the current sample benchmark shown in the README.

## Scope

- Comparison target: `locate()` vs an inspector-protocol baseline
- Inputs: one function and one class constructor
- Validation: both approaches were checked to resolve the same source location before timing
- Measurement: median of repeated rounds

## Environment

- OS: macOS
- Architecture: arm64
- Node.js: `v24.14.0`
- CPU: Apple M4 Max

## Result

| Approach | Median latency / call | Relative speed |
| --- | ---: | ---: |
| `locate` | `0.1250 µs` | `94x faster` |
| `inspector protocol` | `11.79 µs` | `baseline` |

## Raw samples

Native `locate()` samples, µs/call:

```text
0.042000000
0.083000000
0.083000000
0.083000000
0.083000000
0.083000000
0.083000000
0.083000000
0.083000000
0.083000000
```

Inspector baseline samples, µs/call:

```text
10.166000000
10.167000000
10.208000000
10.250000000
10.250000000
10.291000000
10.291000000
10.291000000
10.292000000
10.333000000
```

## Notes

- This was measured with a temporary inline Node.js benchmark, not a committed benchmark helper script.
- Results are sample numbers for this machine and runtime, not a portability guarantee.
