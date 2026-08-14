package ge.domino.ozi;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * The game runs edge to edge: the status bar and the navigation bar are hidden
 * so the table fills the whole screen. Swiping from an edge shows the bars
 * briefly, and they slide away again on their own.
 */
public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    goFullscreen();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    // coming back from the launcher or a dialog brings the bars back — hide them again
    if (hasFocus) goFullscreen();
  }

  private void goFullscreen() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat c =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    if (c != null) {
      c.hide(WindowInsetsCompat.Type.systemBars());
      c.setSystemBarsBehavior(
          WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
  }
}
