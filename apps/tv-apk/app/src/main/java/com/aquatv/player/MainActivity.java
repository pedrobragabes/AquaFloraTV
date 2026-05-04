package com.aquatv.player;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private WebView webView;
    private TextView statusView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        statusView = new TextView(this);
        statusView.setTextColor(0xffffffff);
        statusView.setBackgroundColor(0xff050806);
        statusView.setTextSize(18);
        statusView.setPadding(24, 24, 24, 24);
        statusView.setText("AquaTV carregando...");

        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        root.addView(statusView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        ));
        setContentView(root);

        configureWebView();
        hideSystemUi();
        loadPlayer();
        checkForUpdate();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                statusView.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
            ) {
                if (request.isForMainFrame()) {
                    statusView.setVisibility(View.VISIBLE);
                    statusView.setText("Falha ao abrir AquaTV. Tentando de novo em 10s.\n" + BuildConfig.PLAYER_URL);
                    statusView.postDelayed(MainActivity.this::loadPlayer, 10_000);
                }
            }
        });
    }

    private void loadPlayer() {
        statusView.setVisibility(View.VISIBLE);
        statusView.setText("AquaTV conectando em " + BuildConfig.PLAYER_URL);
        webView.loadUrl(BuildConfig.PLAYER_URL);
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void checkForUpdate() {
        executor.execute(() -> {
            try {
                URL latestUrl = new URL(BuildConfig.API_URL + "/app/latest?channel=STABLE");
                HttpURLConnection connection = (HttpURLConnection) latestUrl.openConnection();
                connection.setConnectTimeout(5_000);
                connection.setReadTimeout(10_000);
                connection.setRequestMethod("GET");

                if (connection.getResponseCode() != 200) {
                    return;
                }

                String json = readAll(connection.getInputStream());
                JSONObject release = new JSONObject(json);
                int versionCode = release.getInt("versionCode");
                if (versionCode <= BuildConfig.VERSION_CODE) {
                    return;
                }

                String versionName = release.optString("versionName", String.valueOf(versionCode));
                String expectedSha = release.optString("apkMd5", "");
                File apk = downloadApk(versionCode, expectedSha);
                runOnUiThread(() -> promptInstall(apk, versionName));
            } catch (Exception ignored) {
                // Update failure must never stop playback.
            }
        });
    }

    private File downloadApk(int versionCode, String expectedSha) throws Exception {
        URL downloadUrl = new URL(BuildConfig.API_URL + "/app/download/" + versionCode);
        HttpURLConnection connection = (HttpURLConnection) downloadUrl.openConnection();
        connection.setConnectTimeout(5_000);
        connection.setReadTimeout(60_000);

        if (connection.getResponseCode() != 200) {
            throw new IllegalStateException("Download HTTP " + connection.getResponseCode());
        }

        File output = new File(getCacheDir(), "aquatv-update-" + versionCode + ".apk");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");

        try (InputStream input = connection.getInputStream();
             FileOutputStream file = new FileOutputStream(output)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                file.write(buffer, 0, read);
                digest.update(buffer, 0, read);
            }
        }

        String actualSha = toHex(digest.digest());
        if (!expectedSha.isEmpty() && !actualSha.equalsIgnoreCase(expectedSha)) {
            throw new IllegalStateException("APK hash invalido");
        }

        return output;
    }

    private void promptInstall(File apk, String versionName) {
        statusView.setVisibility(View.VISIBLE);
        statusView.setText("Atualizacao AquaTV " + versionName + " baixada. Confirme a instalacao.");

        if (android.os.Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            settingsIntent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(settingsIntent);
            return;
        }

        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            startActivity(install);
        } catch (ActivityNotFoundException ignored) {
            statusView.setText("APK baixada, mas o instalador do Android nao abriu.");
        }
    }

    private static String readAll(InputStream input) throws Exception {
        StringBuilder builder = new StringBuilder();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = input.read(buffer)) != -1) {
            builder.append(new String(buffer, 0, read));
        }
        return builder.toString();
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format(Locale.US, "%02x", value));
        }
        return builder.toString();
    }
}
