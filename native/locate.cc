#include <node_api.h>

#include <v8.h>

#include <cstring>

#if defined(__unix__) || defined(__APPLE__)
#include <dlfcn.h>
#endif

#if defined(__APPLE__)
#include <mach-o/dyld.h>
#endif

namespace {

#if defined(__unix__) || defined(__APPLE__)
using GetUnboundScriptFn = v8::MaybeLocal<v8::UnboundScript> (*)(const v8::Function*);

#if defined(__APPLE__)
static void* ResolveAppleSymbol(const char* name) {
  uint32_t imageCount = _dyld_image_count();

  for (uint32_t imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
    const mach_header* imageHeader = _dyld_get_image_header(imageIndex);
    if (imageHeader == nullptr) {
      continue;
    }

#if defined(__clang__)
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
#endif
    NSSymbol symbol = NSLookupSymbolInImage(
      imageHeader,
      name,
      NSLOOKUPSYMBOLINIMAGE_OPTION_RETURN_ON_ERROR
    );
#if defined(__clang__)
#pragma clang diagnostic pop
#endif
    if (symbol != nullptr) {
#if defined(__clang__)
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
#endif
      return NSAddressOfSymbol(symbol);
#if defined(__clang__)
#pragma clang diagnostic pop
#endif
    }
  }

  return nullptr;
}
#endif

template <typename SymbolType>
static SymbolType ResolveSymbol(const char* const* names, size_t count) {
  for (size_t index = 0; index < count; index += 1) {
    void* symbol = dlsym(RTLD_DEFAULT, names[index]);
#if defined(__APPLE__)
    if (symbol == nullptr) {
      symbol = ResolveAppleSymbol(names[index]);
    }
#endif
    if (symbol != nullptr) {
      return reinterpret_cast<SymbolType>(symbol);
    }
  }

  return nullptr;
}

static GetUnboundScriptFn ResolveGetUnboundScript() {
  static const char* const kSymbolNames[] = {
    "_ZNK2v88Function16GetUnboundScriptEv",
    "ZNK2v88Function16GetUnboundScriptEv",
  };
  static GetUnboundScriptFn resolved =
    ResolveSymbol<GetUnboundScriptFn>(kSymbolNames, sizeof(kSymbolNames) / sizeof(kSymbolNames[0]));

  return resolved;
}
#endif

static v8::Local<v8::Value> AsV8Value(const napi_value value) {
  v8::Local<v8::Value> local;
  std::memcpy(&local, &value, sizeof(local));
  return local;
}

static napi_value GetUndefined(napi_env env) {
  napi_value result;
  if (napi_get_undefined(env, &result) != napi_ok) {
    return NULL;
  }
  return result;
}

static bool IsUndefinedValue(napi_env env, napi_value value) {
  if (value == nullptr) {
    return false;
  }

  napi_valuetype type;
  if (napi_typeof(env, value, &type) != napi_ok) {
    return false;
  }

  return type == napi_undefined;
}

static napi_value CreateStringValue(
  napi_env env,
  v8::Isolate* isolate,
  v8::Local<v8::Value> value
) {
  if (value.IsEmpty() || !value->IsString()) {
    return GetUndefined(env);
  }

  v8::String::Value filePath(isolate, value);
  if (*filePath == nullptr) {
    return nullptr;
  }

  napi_value result;
  napi_status status = napi_create_string_utf16(
    env,
    reinterpret_cast<const char16_t*>(*filePath),
    static_cast<size_t>(filePath.length()),
    &result
  );
  if (status != napi_ok) {
    return nullptr;
  }

  return result;
}

static napi_value GetFromScriptOrigin(
  napi_env env,
  v8::Isolate* isolate,
  v8::Local<v8::Function> targetFunction
) {
  return CreateStringValue(
    env,
    isolate,
    targetFunction->GetScriptOrigin().ResourceName()
  );
}

#if defined(__unix__) || defined(__APPLE__)
static napi_value GetFromUnboundScript(
  napi_env env,
  v8::Isolate* isolate,
  v8::Local<v8::Function> targetFunction
) {
  GetUnboundScriptFn getUnboundScript = ResolveGetUnboundScript();
  if (getUnboundScript == nullptr) {
    return GetUndefined(env);
  }

  v8::Local<v8::UnboundScript> script;
  if (!getUnboundScript(targetFunction.operator->()).ToLocal(&script)) {
    return GetUndefined(env);
  }

  v8::Local<v8::Script> boundScript = script->BindToCurrentContext();
  if (boundScript.IsEmpty()) {
    return GetUndefined(env);
  }

#if defined(V8_MAJOR_VERSION) && V8_MAJOR_VERSION >= 11
  return CreateStringValue(env, isolate, boundScript->GetResourceName());
#else
  return CreateStringValue(env, isolate, script->GetScriptName());
#endif
}
#endif

static napi_value GetFunctionLocation(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1] = {nullptr};

  napi_status status = napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to read callback arguments");
    return nullptr;
  }

  if (argc < 1) {
    napi_throw_type_error(env, nullptr, "Function argument expected");
    return nullptr;
  }

  napi_valuetype type;
  status = napi_typeof(env, argv[0], &type);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to resolve argument type");
    return nullptr;
  }

  if (type != napi_function) {
    napi_throw_type_error(env, nullptr, "Function argument expected");
    return nullptr;
  }

  v8::Isolate* isolate = v8::Isolate::GetCurrent();
  if (isolate == nullptr) {
    napi_throw_error(env, nullptr, "Failed to get V8 isolate");
    return nullptr;
  }

  v8::HandleScope scope(isolate);

  v8::Local<v8::Value> target = AsV8Value(argv[0]);
  if (!target->IsFunction()) {
    napi_throw_type_error(env, nullptr, "Function argument expected");
    return nullptr;
  }

  v8::Local<v8::Function> targetFunction = v8::Local<v8::Function>::Cast(target);
#if defined(__unix__) || defined(__APPLE__)
  napi_value fromUnboundScript = GetFromUnboundScript(env, isolate, targetFunction);
  if (fromUnboundScript != nullptr && !IsUndefinedValue(env, fromUnboundScript)) {
    return fromUnboundScript;
  }
#endif

  napi_value fromOrigin = GetFromScriptOrigin(env, isolate, targetFunction);
  if (fromOrigin != nullptr && !IsUndefinedValue(env, fromOrigin)) {
    return fromOrigin;
  }

  if (fromOrigin == nullptr) {
    return nullptr;
  }

  return GetUndefined(env);
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
