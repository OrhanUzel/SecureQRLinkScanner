package com.orhanuzel.secureqrlinkscanner

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Patterns
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(null)
    handleShareIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleShareIntent(intent)
  }

  private fun handleShareIntent(intent: Intent?) {
    if (intent == null) return
    when (intent.action) {
      Intent.ACTION_SEND -> handleSingleShare(intent)
      Intent.ACTION_SEND_MULTIPLE -> handleMultipleShare(intent)
      else -> return
    }
  }

  private fun handleSingleShare(intent: Intent) {
    val type = intent.type ?: return
    when {
      type.startsWith("text/") -> handleSharedText(intent)
      type.startsWith("image/") -> handleSharedImage(intent)
    }
  }

  private fun handleMultipleShare(intent: Intent) {
    val type = intent.type ?: return
    if (!type.startsWith("image/")) return

    val sharedUris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
    if (sharedUris.isNullOrEmpty()) return

    // Take only the first image for now (could be extended to handle multiple)
    val firstUri = sharedUris.first()
    handleSharedImageWithUri(firstUri)
  }

  private fun handleSharedImageWithUri(sharedUri: Uri) {
    val cachedPath = copyImageToCache(sharedUri) ?: return
    val normalized = if (cachedPath.startsWith("file://")) cachedPath else "file://$cachedPath"
    val encoded = Uri.encode(normalized)
    val deepLink = Uri.parse("secureqrlinkscanner://imagescan/$encoded")
    forwardDeepLink(Intent().apply {
      action = Intent.ACTION_SEND
      type = "image/*"
      putExtra(Intent.EXTRA_STREAM, sharedUri)
    }, deepLink)
  }

  private fun handleSharedText(intent: Intent) {
    val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
    if (sharedText.isEmpty()) return

    val url = extractUrl(sharedText) ?: sharedText
    if (url.isEmpty()) return

    val encoded = Uri.encode(url)
    val deepLink = Uri.parse("secureqrlinkscanner://linkscan/$encoded")
    forwardDeepLink(intent, deepLink)
  }

  private fun handleSharedImage(intent: Intent) {
    val sharedUri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM) ?: return
    handleSharedImageWithUri(sharedUri)
  }

  private fun copyImageToCache(source: Uri): String? {
    return try {
      val input = contentResolver?.openInputStream(source) ?: return null
      val target = File(cacheDir, "shared_image_${System.currentTimeMillis()}.jpg")
      writeStreamToFile(input, target)
      target.absolutePath
    } catch (_: Exception) {
      null
    }
  }

  private fun writeStreamToFile(input: InputStream, target: File) {
    input.use { stream ->
      FileOutputStream(target).use { output ->
        stream.copyTo(output)
      }
    }
  }

  private fun forwardDeepLink(intent: Intent, deepLink: Uri) {
    intent.action = Intent.ACTION_VIEW
    intent.data = deepLink
    intent.putExtra("expo.modules.intent.extra.LINKING_URI", deepLink.toString())
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    setIntent(intent)
    
    // Force deliver the new intent to React Native
    onNewIntent(intent)
  }

  private fun extractUrl(text: String): String? {
    val matcher = Patterns.WEB_URL.matcher(text)
    return if (matcher.find()) {
      matcher.group()?.trim()?.removeSuffix(".")
    } else {
      null
    }
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled
      ) {}
    )
  }

  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}