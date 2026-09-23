{
  "targets": [
    {
      "target_name": "function_location_binding",
      "sources": ["native/locate.cc"],
      "defines": ["NAPI_VERSION=1"],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ]
    }
  ],
  "variables": {
    "enable_thin_lto%": "false",
    "lto_jobs%": ""
  }
}
