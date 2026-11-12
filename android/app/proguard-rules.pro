# Project-specific ProGuard/R8 rules.
# Capacitor resolves plugins reflectively by class name and calls
# @PluginMethod-annotated methods from JS, so those entry points must survive.

# Local plugin: registered by MainActivity and invoked from JS by name.
-keep class com.jmfmobile.SafStoragePlugin { *; }

# Every plugin subclass: keep the class plus its JS-facing methods.
-keep public class * extends com.getcapacitor.Plugin {
    public <methods>;
    public <fields>;
}

-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PluginMethod public <methods>;
    @com.getcapacitor.annotation.PermissionCallback public <methods>;
    @com.getcapacitor.annotation.ActivityCallback public <methods>;
}

# Cordova plugins are looked up by service name / reflection.
-keep public class * extends org.apache.cordova.CordovaPlugin {
    public <methods>;
    public <fields>;
}

# Keep line numbers so WebView console stack traces stay readable.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor checks these annotations at runtime.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

-dontwarn org.apache.cordova.**
