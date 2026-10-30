package com.miraclepenguin.theroute;

import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * 키보드(IME)가 열리면 WebView 를 키보드 위까지로 줄인다.
 *
 * Android 15(targetSdk 35)는 edge-to-edge 가 강제돼 windowSoftInputMode=adjustResize 가 더 이상
 * 창을 줄이지 않는다. capacitor.config 의 android.adjustMarginsForEdgeToEdge: 'auto' 는 WebView
 * margin 을 시스템 바·컷아웃만큼만 준다 — 키보드는 계산하지 않는다.
 * 그래서 Capacitor 가 onCreate 중에 건 인셋 리스너를 같은 계산 + 키보드로 교체한다:
 * 하단 margin = max(내비게이션 바, 키보드). 키보드가 닫히면 ime = 0 이라 내비게이션 바만큼으로 돌아간다.
 * WebView 가 실제로 줄어들어야 웹의 고정 하단 탭·스크롤 영역이 키보드 위에서 다시 계산된다.
 *
 * API 34 이하는 edge-to-edge 강제가 아니라 매니페스트 adjustResize 가 창을 줄이므로 손대지 않는다
 * (거기에 키보드 margin 까지 주면 이중으로 줄어든다).
 *
 * 위치 권한 프롬프트(WebView geolocation)는 여기서 다루지 않는다 — Capacitor 7 의 기본
 * BridgeWebChromeClient 가 onGeolocationPermissionsShowPrompt 를 구현해 앱 런타임 권한을 요청한 뒤
 * WebView 에 결과를 넘긴다(@capacitor/android 7.6.10 소스 확인, 2026-10-30). WebChromeClient 를
 * 여기서 교체하면 그 처리와 파일 선택·카메라 처리를 함께 잃으므로 교체하지 않는다.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            mlp.leftMargin = bars.left;
            mlp.topMargin = bars.top;
            mlp.rightMargin = bars.right;
            mlp.bottomMargin = Math.max(bars.bottom, ime.bottom);
            v.setLayoutParams(mlp);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
