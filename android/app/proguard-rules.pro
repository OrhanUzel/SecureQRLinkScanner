# React Native ProGuard Configuration
# Bu dosyayı android/app/proguard-rules.pro olarak kaydedin

# ===== TEMEL REACT NATIVE KURALLARI =====
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.soloader.** { *; }

# React Native Bridge
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

#-keep @com.facebook.react.bridge.ReactModule class * { *; }
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }

# Hermes Engine
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ===== EXPO KURALLARI =====
-keep class expo.modules.** { *; }
-keep class versioned.host.exp.exponent.** { *; }

# Expo Camera
-keep class expo.modules.camera.** { *; }

# Expo Image Picker
-keep class expo.modules.imagepicker.** { *; }

# Expo File System
-keep class expo.modules.filesystem.** { *; }

# Expo Media Library
-keep class expo.modules.medialibrary.** { *; }

# Expo Secure Store
-keep class expo.modules.securestore.** { *; }

# Expo Linking
-keep class expo.modules.linking.** { *; }

# ===== REACT NATIVE ML KIT (BARCODE SCANNING) =====
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.vision.** { *; }
-keep class com.google.mlkit.vision.barcode.** { *; }

-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.**

# ===== REACT NAVIGATION =====
-keep class * extends androidx.fragment.app.Fragment {}
-keep class * extends com.facebook.react.ReactActivity { *; }

# ===== ASYNC STORAGE =====
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# ===== NETINFO =====
-keep class com.reactnativecommunity.netinfo.** { *; }

# ===== REACT NATIVE GESTURE HANDLER =====
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.gesturehandler.react.** { *; }

# ===== REACT NATIVE REANIMATED =====
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ===== REACT NATIVE SCREENS =====
-keep class com.swmansion.rnscreens.** { *; }

# ===== REACT NATIVE SVG =====
-keep class com.horcrux.svg.** { *; }

# ===== REACT NATIVE VIEW SHOT =====
-keep class fr.greweb.reactnativeviewshot.** { *; }

# ===== GOOGLE MOBILE ADS =====
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-dontwarn com.google.android.gms.ads.**

# ===== REVENUECAT (PURCHASES) =====
-keep class com.revenuecat.purchases.** { *; }
-keep class com.android.billingclient.api.** { *; }
-dontwarn com.revenuecat.purchases.**

# ===== REACT NATIVE SAFE AREA CONTEXT =====
-keep class com.th3rdwave.safeareacontext.** { *; }

# ===== REACT NATIVE IN-APP REVIEW =====
-keep class com.google.android.play.core.** { *; }
-dontwarn com.google.android.play.core.**

# ===== JAVAX ANNOTATIONS =====
-dontwarn javax.annotation.**
-keep class javax.annotation.** { *; }

# ===== OKHTTP & NETWORKING =====
-keepattributes Signature
-keepattributes *Annotation*
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ===== FRESCO (IMAGE LOADING) =====
-keep @com.facebook.common.internal.DoNotStrip class * { *; }
-keep @com.facebook.soloader.DoNotOptimize class * { *; }
-keep class com.facebook.imagepipeline.** { *; }
-keep class com.facebook.drawee.** { *; }

# ===== GSON / JSON =====
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
#-keep class * implements com.google.gson.TypeAdapter
#-keep class * implements com.google.gson.TypeAdapterFactory
#-keep class * implements com.google.gson.JsonSerializer
#-keep class * implements com.google.gson.JsonDeserializer

# ===== KOTLIN =====
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings {
    <fields>;
}

# ===== GENEL ANDROID KURALLARI =====
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Crashlytics için stack trace bilgilerini koru
-keepattributes SourceFile,LineNumberTable

# Enum sınıfları
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Parcelable
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Serializable
-keepnames class * implements java.io.Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ===== OPTİMİZASYON AYARLARI =====
-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose

# ===== UYARILAR =====
-dontwarn com.facebook.react.**
-dontwarn java.nio.file.*
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement

# ===== EKLENMESİ GEREKEN KRİTİK KURALLAR =====

# Google Play Services & Tasks (ML Kit ve AdMob için kritik)
-keep class com.google.android.gms.tasks.** { *; }
-dontwarn com.google.android.gms.tasks.**

# Kotlin Coroutines (Modern Expo modülleri ve React Native 0.74+ sonrası için şart)
-keep class kotlinx.coroutines.** { *; }
-keepclassmembers class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**


# React Native Reanimated (Layout Animations için ek güvenlik)
-keep class com.swmansion.reanimated.layoutReanimation.** { *; }