{
  "targets": [
    {
      "target_name": "locate",
      "sources": ["locate.cc"],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ]
    }
  ]
}
