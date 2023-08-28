#include <napi.h>

void GetFunctionLocation(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsFunction()) {
    Napi::TypeError::New(env, "Function argument expected").ThrowAsJavaScriptException();
    return;
  }

  Napi::Function targetFunction = info[0].As<Napi::Function>();

  Napi::Value scriptOriginValue = targetFunction.Get("scriptOrigin").As<Napi::Object>().Get("resourceName");

  if (!scriptOriginValue.IsUndefined()) {
    Napi::Value scriptName = scriptOriginValue;
    if (scriptName.IsString()) {
      info.GetReturnValue().Set(scriptName);
      return;
    }
  }

  info.GetReturnValue().SetUndefined();
}

Napi::Object Initialize(Napi::Env env, Napi::Object exports) {
  exports.Set("locate", Napi::Function::New(env, GetFunctionLocation));
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Initialize)

