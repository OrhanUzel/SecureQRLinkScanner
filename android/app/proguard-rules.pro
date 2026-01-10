# ==========================================================================
#  SECURE QR & LINK SCANNER - OPTİMİZE EDİLMİŞ PROGUARD KURALLARI
# ==========================================================================

# --------------------------------------------------------------------------
# 1. REACT NATIVE, HERMES & EXPO ÇEKİRDEK
# --------------------------------------------------------------------------
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class expo.modules.** { *; }
-keep class expo.modules.kotlin.** { *; }

# Reanimated (Navigasyon ve animasyonlar için kritik)
-keep class com.swmansion.reanimated.** { *; }

# --------------------------------------------------------------------------
# 2. REACT NAVIGATION & UI
# --------------------------------------------------------------------------
-keep class com.swmansion.rnscreens.** { *; }
-keep class androidx.appcompat.** { *; }
-keep class androidx.fragment.app.** { *; }
-keepattributes *Annotation*

# Vector Icons (İkonların "X" görünmesini engeller)
-keep class com.oblador.vectoricons.** { *; }

# --------------------------------------------------------------------------
# 3. GOOGLE ADS & ADMOB (GELİR İÇİN KRİTİK)
# --------------------------------------------------------------------------
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.ads.** { *; }
-keep public class com.google.android.gms.ads.** { public *; }
-keep class com.google.android.gms.ads.nativead.** { *; }

# --------------------------------------------------------------------------
# 4. IN-APP PURCHASES (IAP - SATIN ALMALAR)
# Hem Google Billing hem de RNIap kütüphanesi korunmalı.
# --------------------------------------------------------------------------
-keep class com.android.vending.billing.** { *; }
-keep class com.android.billingclient.api.** { *; }
-keep class com.dooboolab.RNIap.** { *; }

# --------------------------------------------------------------------------
# 5. ML KIT, CAMERA & MEDIA
# --------------------------------------------------------------------------
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.vision.** { *; }
-keep class com.google.android.gms.tasks.** { *; }
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# React Native View Shot (Ekran Görüntüsü)
-keep class fr.greweb.reactnativeviewshot.** { *; }

# --------------------------------------------------------------------------
# 6. NITRO MODULES (Hızlı modüller için kritik)
# --------------------------------------------------------------------------
-keep class com.margelo.nitro.** { *; }
-keep class * extends com.margelo.nitro.** { *; }
-keep interface com.margelo.nitro.** { *; }

# --------------------------------------------------------------------------
# 7. WEBVIEW & ASYNC STORAGE
# --------------------------------------------------------------------------
-keep class android.webkit.** { *; }
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# --------------------------------------------------------------------------
# 8. NETWORK & GENEL JAVA GÜVENLİĞİ (OkHttp/Retrofit)
# --------------------------------------------------------------------------
-keepattributes InnerClasses,EnclosingMethod,Signature,Exceptions,SourceFile,LineNumberTable

# OkHttp & Retrofit
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.apache.http.**
-keep class retrofit2.** { *; }
-dontwarn retrofit2.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement