# Benchmark Notes

This document records the current sample benchmark shown in the README.

## Scope

- Comparison target: `locate()` vs an inspector-protocol baseline
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
| `locate` | `0.1197 µs` | `1878.60x faster` |
| `inspector protocol` | `224.8900 µs` | `baseline` |

## Raw samples

Native `locate()` samples, µs/call:

```text
0.1325
0.1298
0.1232
0.1219
0.1208
0.1159
0.1155
0.1159
0.1176
0.1175
0.1181
0.1157
0.1169
0.1180
0.1167
0.1163
0.1184
0.1175
0.1165
0.1191
0.1170
0.1150
0.1174
0.1187
0.1217
0.1196
0.1177
0.1155
0.1172
0.1178
0.1186
0.1202
0.1192
0.1207
0.1218
0.1200
0.1180
0.1199
0.1227
0.1202
0.1205
0.1216
0.1209
0.1174
0.1189
0.1220
0.1248
0.1181
0.1203
0.1213
0.1192
0.1196
0.1206
0.1219
0.1211
0.1201
0.1213
0.1223
0.1197
0.1209
0.1198
0.1187
0.1195
0.1201
0.1199
0.1185
0.1194
0.1219
0.1254
0.1230
0.1197
0.1203
0.1192
0.1237
0.1205
0.1197
0.1205
0.1213
0.1198
0.1210
0.1187
0.1190
0.1196
0.1192
0.1218
0.1183
0.1219
0.1170
0.1224
0.1197
0.1216
0.1228
0.1195
0.1239
0.1235
0.1205
0.1190
0.1172
0.1189
0.1204
```

Inspector baseline samples, µs/call:

```text
176.3113
187.8290
190.6337
197.0290
189.2688
189.9990
193.3638
199.1179
195.8423
201.7717
197.7219
203.5775
194.6581
196.7315
198.7108
240.7950
210.8923
196.1798
212.9663
248.2392
246.5394
223.6927
213.7623
236.0135
226.7617
223.6479
216.9252
239.0683
238.4313
224.0142
220.5175
244.5788
265.6294
260.5469
206.7729
221.5117
194.4208
223.8221
222.4448
241.4938
242.0254
247.7587
229.1983
221.5610
220.4385
228.4812
212.9096
242.8404
222.7675
228.8771
225.7658
246.8627
216.2808
214.5958
236.0369
250.2206
229.0060
235.5273
251.3675
251.0990
247.8240
226.0448
264.3677
268.1717
234.4748
205.2390
211.6610
220.4021
202.8271
203.3950
199.2817
219.3740
214.3988
212.0758
205.0917
232.7808
221.4085
266.5412
214.4340
245.0167
212.4125
216.9750
229.1960
259.9508
210.7110
238.4354
251.3131
271.7306
271.3683
253.9673
256.6340
299.5219
297.9029
258.2317
267.6042
285.1175
315.5625
266.4463
276.5008
315.7229
```

## Notes

- This was measured with the committed `npm run benchmark` helper.
- The inspector baseline resolves the target location through the inspector protocol on each call, without caching a precomputed file path.
- The chart image is rendered from [docs/benchmark-locate.html](./benchmark-locate.html) using Chart.js and then exported to PNG.
- Results are sample numbers for this machine and runtime, not a portability guarantee.
