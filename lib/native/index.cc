#include <node.h>
#include <v8.h>

using namespace v8;

void GetFunctionLocation(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  if (args.Length() < 1 || !args[0]->IsFunction()) {
    isolate->ThrowException(Exception::TypeError(
        String::NewFromUtf8Literal(isolate, "Function argument expected")));
    return;
  }

  Local<Function> targetFunction = Local<Function>::Cast(args[0]);

  ScriptOrigin scriptOrigin(isolate, targetFunction->GetScriptOrigin());

  if (!scriptOrigin.ResourceName().IsEmpty()) {
    Local<Value> scriptName = scriptOrigin.ResourceName();
    if (scriptName->IsString()) {
      args.GetReturnValue().Set(scriptName);
      return;
    }
  }

  args.GetReturnValue().SetUndefined();
}

void Initialize(Local<Object> exports) {
  NODE_SET_METHOD(exports, "getFunctionLocation", GetFunctionLocation);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)