{
  "targets": [
    {
      "target_name": "locate",
      "sources": ["native/locate.cc"],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ]
    }
  ]
}
