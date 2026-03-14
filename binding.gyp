{
  "targets": [
    {
      "target_name": "locate",
      "sources": ["native/locate.cc"],
      "defines": ["NAPI_VERSION=1"],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ]
    }
  ],
  "variables": {
    "openssl_fips": ""
  }
}
