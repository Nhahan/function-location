#include <node_api.h>

napi_value GetFunctionLocation(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_value jsReturnValue;

  napi_get_cb_info(env, info, &argc, args, NULL, NULL);

  if (argc < 1) {
    napi_throw_type_error(env, NULL, "Function argument expected");
    return NULL;
  }

  napi_valuetype valueType;
  napi_typeof(env, args[0], &valueType);

  if (valueType != napi_function) {
    napi_throw_type_error(env, NULL, "Function argument expected");
    return NULL;
  }

  napi_value targetFunction = args[0];

  napi_value scriptOriginValue;
  napi_get_named_property(env, targetFunction, "name", &scriptOriginValue);

  napi_value scriptName;
  napi_coerce_to_string(env, scriptOriginValue, &scriptName);

  napi_get_undefined(env, &jsReturnValue);

  return jsReturnValue;
}

napi_value Initialize(napi_env env, napi_value exports) {
  napi_property_descriptor desc = {"locate", NULL, GetFunctionLocation, NULL, NULL, NULL, napi_default, NULL};
  napi_define_properties(env, exports, 1, &desc);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Initialize)