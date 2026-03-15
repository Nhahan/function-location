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
- Node.js: `v22.20.0`

## Result

| Approach | Median latency / call | Relative speed |
| --- | ---: | ---: |
| `locate` | `0.1126 µs` | `1413x faster` |
| `inspector protocol` | `159.12 µs` | `baseline` |

## Raw samples

Native `locate()` samples, µs/call:

```text
0.12965425
0.115545333
0.113217041
0.113052084
0.111921167
0.111531375
0.111711083
0.112199459
0.112636042
```

Inspector baseline samples, µs/call:

```text
137.1955923076923
159.11843076923077
155.6633
156.77107307692307
156.81362115384616
176.43774038461538
169.46802884615386
173.6127403846154
180.23517692307692
```

## Notes

- This was measured with a temporary inline Node.js benchmark, not a committed benchmark helper script.
- Results are sample numbers for this machine and runtime, not a portability guarantee.
