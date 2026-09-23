# Benchmark Notes

This document records the current sample benchmark shown in the README.

## Scope

- Comparison target: `locateV8()` vs an inspector-protocol baseline
- Inputs: one function and one class constructor
- Validation: both approaches were checked to resolve the same source location before timing
- Measurement: median of repeated rounds
- Rounds: `100`
- Display precision: 4 decimal places in the summary table and raw samples

## Environment

- OS: macOS
- Architecture: arm64
- Node.js: `v22.20.0`
- CPU: Apple M4 Max

## Result

| Approach | Median latency / call | Relative speed |
| --- | ---: | ---: |
| `locateV8` | `0.0254 µs` | `14438.93x faster` |
| `inspector protocol` | `367.4543 µs` | `baseline` |

## Raw samples

Native `locateV8()` samples, µs/call:

```text
0.0299
0.0267
0.0285
0.0296
0.0304
0.0281
0.0255
0.0256
0.0230
0.0243
0.0246
0.0276
0.0290
0.0246
0.0287
0.0251
0.0240
0.0255
0.0244
0.0263
0.0262
0.0243
0.0333
0.0283
0.0250
0.0249
0.0251
0.0251
0.0257
0.0248
0.0262
0.0490
0.0267
0.0245
0.0250
0.0266
0.0246
0.0249
0.0241
0.0267
0.0277
0.0249
0.0448
0.0273
0.0247
0.0248
0.0252
0.0242
0.0258
0.0329
0.0304
0.0265
0.0254
0.0239
0.0266
0.0261
0.0249
0.0278
0.0271
0.0269
0.0407
0.0272
0.0241
0.0253
0.0240
0.0257
0.0269
0.0277
0.0250
0.0401
0.0250
0.0240
0.0250
0.0246
0.0250
0.0262
0.0247
0.0305
0.0280
0.0263
0.0264
0.0253
0.0246
0.0247
0.0252
0.0281
0.0378
0.0250
0.0246
0.0244
0.0245
0.0257
0.0239
0.0236
0.0252
0.0237
0.0249
0.0464
0.0273
0.0240
```

Inspector baseline samples, µs/call:

```text
243.0102
341.5142
265.7000
296.9246
288.8742
276.0471
369.4806
301.1800
286.1694
370.1642
285.4627
273.1606
308.7427
278.7179
317.6085
384.8256
331.3065
336.2600
290.6108
336.4040
376.8442
298.8823
313.1269
333.6783
390.3108
324.8702
390.0254
369.8373
445.4965
366.5921
446.6829
372.9515
356.0190
379.0042
323.3165
446.2556
366.1625
369.9812
358.1894
405.5619
348.5696
282.3190
321.8975
341.1029
288.3592
368.4433
355.3456
304.2035
329.9513
351.9488
268.9479
354.2738
378.6388
334.8844
317.0675
381.7640
299.4973
309.9908
391.5823
383.4956
413.2729
393.1983
439.7492
390.7296
373.4494
331.2085
373.3942
371.2815
312.9190
448.5248
385.7990
409.1425
327.1273
405.4915
386.1123
426.1429
374.9190
351.1938
346.1319
527.0627
445.7423
341.8067
478.6350
356.3660
425.1333
368.3165
369.7669
351.7975
416.5190
347.6329
446.3602
384.4379
463.8373
440.8402
464.3090
429.6508
463.5673
558.6548
484.1658
449.2337
```

## Notes

- This was measured with the committed `npm run benchmark` helper.
- The inspector baseline resolves the target location through the inspector protocol on each call, without caching a precomputed file path.
- The chart image is rendered from [docs/benchmark-locate.html](./benchmark-locate.html) using Chart.js and then exported to PNG.
- Results are sample numbers for this machine and runtime, not a portability guarantee.
