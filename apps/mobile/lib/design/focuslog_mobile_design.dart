import 'package:flutter/material.dart';

class FocusLogMobileDesign {
  const FocusLogMobileDesign._();

  static const seed = Color(0xffd6ff4e);
  static const accent = Color(0xffd6ff4e);
  static const coral = Color(0xffff7a5c);
  static const blue = Color(0xff6fa8ff);
  static const purple = Color(0xffb98cff);
  static const darkBg = Color(0xff0b0b0f);
  static const darkCard = Color(0xff151519);
  static const darkCard2 = Color(0xff1c1c22);
  static const darkCard3 = Color(0xff202027);
  static const darkLine = Color(0xff26262e);
  static const darkInk = Color(0xfff3f2ef);
  static const darkInkSoft = Color(0xff8c8b96);
  static const lightBg = Color(0xfff5f2ea);
  static const lightCard = Color(0xffffffff);
  static const lightCard2 = Color(0xfff1eee4);
  static const lightLine = Color(0xffe3dfd0);
  static const lightInk = Color(0xff1c1a15);
  static const lightAccent = Color(0xff4b7f3c);

  static bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  static Color card(BuildContext context) =>
      isDark(context) ? darkCard : lightCard;

  static Color cardAlt(BuildContext context) =>
      isDark(context) ? darkCard2 : lightCard2;

  static Color line(BuildContext context) =>
      isDark(context) ? darkLine : lightLine;

  static Color muted(BuildContext context) =>
      isDark(context) ? darkInkSoft : const Color(0xff726f63);

  static Color activeAccent(BuildContext context) =>
      isDark(context) ? accent : lightAccent;

  static ThemeData theme(ColorScheme base) {
    final dark = base.brightness == Brightness.dark;
    final primary = dark ? accent : lightAccent;
    final colors = ColorScheme.fromSeed(
      seedColor: primary,
      brightness: base.brightness,
    ).copyWith(
      primary: primary,
      secondary: dark ? blue : const Color(0xff3e6fd1),
      tertiary: dark ? purple : const Color(0xff7457c4),
      error: dark ? coral : const Color(0xffe0654a),
      surface: dark ? darkBg : lightBg,
      onPrimary: dark ? darkBg : Colors.white,
      onSurface: dark ? darkInk : lightInk,
      onSurfaceVariant: dark ? darkInkSoft : const Color(0xff726f63),
      outline: dark ? darkLine : lightLine,
      outlineVariant: dark ? const Color(0xff1e1e25) : const Color(0xffece8dc),
    );

    final textTheme = Typography.material2021(
      platform: TargetPlatform.android,
      colorScheme: colors,
    ).black.apply(
          fontFamily: 'Public Sans',
          bodyColor: colors.onSurface,
          displayColor: colors.onSurface,
        );

    return ThemeData(
      colorScheme: colors,
      brightness: base.brightness,
      useMaterial3: true,
      scaffoldBackgroundColor: colors.surface,
      canvasColor: colors.surface,
      textTheme: textTheme.copyWith(
        displaySmall: textTheme.displaySmall?.copyWith(
          fontFamily: 'Fraunces',
          fontWeight: FontWeight.w600,
          letterSpacing: -0.8,
          height: 1.02,
        ),
        headlineMedium: textTheme.headlineMedium?.copyWith(
          fontFamily: 'Fraunces',
          fontWeight: FontWeight.w600,
          letterSpacing: -0.55,
          height: 1.05,
        ),
        headlineSmall: textTheme.headlineSmall?.copyWith(
          fontFamily: 'Fraunces',
          fontWeight: FontWeight.w600,
          letterSpacing: -0.35,
          height: 1.08,
        ),
        titleLarge: textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          letterSpacing: -0.2,
        ),
        titleMedium: textTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
        ),
        labelSmall: textTheme.labelSmall?.copyWith(
          fontFamily: 'IBM Plex Mono',
          letterSpacing: 1.1,
          fontWeight: FontWeight.w500,
        ),
        bodyMedium: textTheme.bodyMedium?.copyWith(
          color: colors.onSurfaceVariant,
          height: 1.48,
        ),
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        centerTitle: false,
        scrolledUnderElevation: 0,
        backgroundColor: colors.surface,
        foregroundColor: colors.onSurface,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        margin: EdgeInsets.zero,
        color: dark ? darkCard : lightCard,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: colors.outline),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: dark ? darkCard2 : lightCard2,
        selectedColor: primary,
        side: BorderSide(color: colors.outline),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        labelStyle: TextStyle(
          color: dark ? darkInkSoft : const Color(0xff726f63),
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
      dividerTheme: DividerThemeData(
        color: colors.outlineVariant,
        space: 28,
        thickness: 1,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? darkCard2 : lightCard,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: colors.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: colors.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: primary, width: 1.4),
        ),
        hintStyle: TextStyle(color: colors.onSurfaceVariant),
        labelStyle: TextStyle(color: colors.onSurfaceVariant),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 48),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          backgroundColor: primary,
          foregroundColor: dark ? darkBg : Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 46),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          side: BorderSide(color: colors.outline),
          foregroundColor: colors.onSurface,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primary,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          backgroundColor: dark ? darkCard2 : lightCard,
          foregroundColor: colors.onSurface,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        elevation: 0,
        height: 64,
        backgroundColor:
            (dark ? darkCard : lightCard).withAlpha((255 * 0.90).round()),
        indicatorColor: primary,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w800,
            color: states.contains(WidgetState.selected)
                ? (dark ? darkBg : Colors.white)
                : colors.onSurfaceVariant,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? (dark ? darkBg : Colors.white)
                : colors.onSurfaceVariant,
            size: 21,
          ),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: dark ? darkBg : lightBg,
        elevation: 0,
        indicatorColor: primary,
        selectedIconTheme: IconThemeData(color: dark ? darkBg : Colors.white),
        unselectedIconTheme: IconThemeData(color: colors.onSurfaceVariant),
        selectedLabelTextStyle: TextStyle(
          color: colors.onSurface,
          fontWeight: FontWeight.w800,
        ),
        unselectedLabelTextStyle: TextStyle(
          color: colors.onSurfaceVariant,
          fontWeight: FontWeight.w600,
        ),
      ),
      tabBarTheme: TabBarThemeData(
        dividerColor: Colors.transparent,
        indicatorSize: TabBarIndicatorSize.tab,
        indicator: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          color: primary,
        ),
        labelColor: dark ? darkBg : Colors.white,
        unselectedLabelColor: colors.onSurfaceVariant,
        labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? primary
              : colors.onSurfaceVariant,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? primary.withAlpha((255 * 0.34).round())
              : colors.outline,
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        backgroundColor: dark ? darkCard2 : lightInk,
        contentTextStyle: TextStyle(
          color: dark ? darkInk : lightCard,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    );
  }

  static BoxDecoration backdrop(BuildContext context) {
    final dark = isDark(context);
    return BoxDecoration(
      color: dark ? darkBg : lightBg,
      gradient: dark
          ? const RadialGradient(
              center: Alignment(-0.8, -0.9),
              radius: 1.2,
              colors: [Color(0x223d4d16), darkBg],
            )
          : const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [lightBg, Color(0xffeee9dc)],
            ),
    );
  }
}

class FocusLogGradientScaffold extends StatelessWidget {
  const FocusLogGradientScaffold({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: FocusLogMobileDesign.backdrop(context),
        child: child,
      );
}

class FocusLogPageHeader extends StatelessWidget {
  const FocusLogPageHeader({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.description,
    this.action,
  });

  final String eyebrow;
  final String title;
  final String description;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 8, 2, 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: FocusLogMobileDesign.activeAccent(context),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: FocusLogMobileDesign.activeAccent(context)
                                .withAlpha((255 * 0.55).round()),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      eyebrow.toUpperCase(),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colors.onSurfaceVariant,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(title, style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 6),
                Text(description),
              ],
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: 12),
            action!,
          ],
        ],
      ),
    );
  }
}

class FocusLogCard extends StatelessWidget {
  const FocusLogCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.accent = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final dark = FocusLogMobileDesign.isDark(context);
    final accentColor = FocusLogMobileDesign.activeAccent(context);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: accent
            ? accentColor.withAlpha((255 * (dark ? 0.10 : 0.12)).round())
            : FocusLogMobileDesign.card(context),
        gradient: accent
            ? LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  accentColor.withAlpha((255 * (dark ? 0.12 : 0.16)).round()),
                  FocusLogMobileDesign.card(context),
                ],
              )
            : null,
        border: Border.all(
          color: accent
              ? accentColor.withAlpha((255 * 0.28).round())
              : FocusLogMobileDesign.line(context),
        ),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class FocusLogStatusPill extends StatelessWidget {
  const FocusLogStatusPill({super.key, required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final accentColor = FocusLogMobileDesign.activeAccent(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: FocusLogMobileDesign.cardAlt(context),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: FocusLogMobileDesign.line(context)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: accentColor),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: FocusLogMobileDesign.muted(context),
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ),
          ),
        ],
      ),
    );
  }
}
