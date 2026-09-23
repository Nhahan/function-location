#include <node_api.h>

#include <v8.h>

#include <cstring>

namespace {

static v8::Local<v8::Value> AsV8Value(const napi_value value) {
  v8::Local<v8::Value> local;
  std::memcpy(&local, &value, sizeof(local));
  return local;
}

// Node's N-API represents napi_value as a v8::Local<v8::Value>, so an existing
// string can be returned as-is instead of being copied into a new one.
static napi_value AsNapiValue(v8::Local<v8::Value> local) {
  napi_value value;
  std::memcpy(&value, &local, sizeof(value));
  return value;
}

static bool IsNonEmptyString(v8::Local<v8::Value> value) {
  return !value.IsEmpty() && value->IsString() && v8::Local<v8::String>::Cast(value)->Length() > 0;
}

static v8::Local<v8::Function> UnwrapBoundFunction(v8::Local<v8::Function> function) {
  v8::Local<v8::Value> boundTarget = function->GetBoundFunction();
  while (boundTarget->IsFunction()) {
    function = v8::Local<v8::Function>::Cast(boundTarget);
    boundTarget = function->GetBoundFunction();
  }

  return function;
}

static napi_value GetFunctionLocation(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1] = {nullptr};

  napi_status status = napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to read callback arguments");
    return nullptr;
  }

  napi_valuetype type = napi_undefined;
  if (argc >= 1 && napi_typeof(env, argv[0], &type) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to resolve argument type");
    return nullptr;
  }

  if (type != napi_function) {
    napi_throw_type_error(env, nullptr, "Function argument expected");
    return nullptr;
  }

  // No local HandleScope: every handle created here, including the returned
  // path, must live in the callback scope N-API already opened.
  v8::Local<v8::Function> function = UnwrapBoundFunction(v8::Local<v8::Function>::Cast(AsV8Value(argv[0])));

  v8::Local<v8::Value> resourceName = function->GetScriptOrigin().ResourceName();
  if (IsNonEmptyString(resourceName)) {
    return AsNapiValue(resourceName);
  }

  napi_value result;
  if (napi_get_undefined(env, &result) != napi_ok) {
    return nullptr;
  }

  return result;
}

}  // namespace

static napi_value Initialize(napi_env env, napi_value exports) {
  napi_value function;
  napi_status status = napi_create_function(env, "locateV8", NAPI_AUTO_LENGTH, GetFunctionLocation, nullptr, &function);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to create locateV8 function");
    return NULL;
  }

  status = napi_set_named_property(env, exports, "locateV8", function);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to export locateV8 function");
    return NULL;
  }

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Initialize)
