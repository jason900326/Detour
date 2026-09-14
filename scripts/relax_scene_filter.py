from pathlib import Path

path = Path('src/lib/scene-engine.ts')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        """  if (\n    ['park', 'garden'].includes(tags.leisure ?? '') &&\n    Boolean(tags.name)\n  ) {\n    return { kind: 'green-space', label: '綠地' };\n  }""",
        """  if (\n    ['park', 'garden'].includes(tags.leisure ?? '')\n  ) {\n    return { kind: 'green-space', label: '綠地' };\n  }""",
    ),
    (
        """  // Never resurrect anonymous generic infrastructure as a destination.\n  if (\n    ['steps', 'footbridge', 'pedestrian'].includes(kind) &&\n    !hasStrongIdentity(tags)\n  ) {\n    return null;\n  }\n\n  if (\n    kind === 'historic' &&\n    !hasStrongIdentity(tags)\n  ) {\n    return null;\n  }""",
        """  // Discovery should be permissive. Anonymous public infrastructure is\n  // fallback material rather than an automatic rejection; routing and the\n  // public-access gates still decide whether it can become a real ticket.\n  if (\n    ['steps', 'footbridge', 'pedestrian'].includes(kind) &&\n    !hasStrongIdentity(tags)\n  ) {\n    return 'fallback';\n  }\n\n  if (\n    kind === 'historic' &&\n    !hasStrongIdentity(tags)\n  ) {\n    return 'fallback';\n  }""",
    ),
    (
        """  if (\n    ['mural', 'street-art', 'artwork', 'statue'].includes(kind)\n  ) {\n    return qualityScore >= 30\n      ? 'primary'\n      : null;\n  }""",
        """  if (\n    ['mural', 'street-art', 'artwork', 'statue'].includes(kind)\n  ) {\n    return qualityScore >= 30\n      ? 'primary'\n      : qualityScore >= 18\n        ? 'fallback'\n        : null;\n  }""",
    ),
    (
        """    return qualityScore >= 26\n      ? 'primary'\n      : qualityScore >= 20\n        ? 'fallback'\n        : null;""",
        """    return qualityScore >= 26\n      ? 'primary'\n      : qualityScore >= 14\n        ? 'fallback'\n        : null;""",
    ),
    (
        """  if (kind === 'green-space') {\n    return Boolean(tags.name)\n      ? 'fallback'\n      : null;\n  }""",
        """  if (kind === 'green-space') {\n    return 'fallback';\n  }""",
    ),
    (
        """  if (qualityScore >= 16) {\n    return 'fallback';\n  }""",
        """  if (qualityScore >= 10) {\n    return 'fallback';\n  }""",
    ),
    (
        """  if (distanceMeters > profile.max * 1.18) return -999;""",
        """  // Candidate discovery should not reject a place just because the\n  // straight-line estimate is imperfect. The routed-walk stage is the\n  // authority on whether the trip actually fits the selected time.\n  if (distanceMeters > profile.max * 1.55) return -999;""",
    ),
    (
        """  nwr${around}[\"leisure\"~\"park|garden\"][\"name\"];\n  nwr${around}[\"historic\"][\"name\"];""",
        """  nwr${around}[\"leisure\"~\"park|garden\"];\n  nwr${around}[\"historic\"];""",
    ),
    (
        """  way${around}[\"highway\"=\"pedestrian\"][\"name\"];""",
        """  way${around}[\"highway\"=\"pedestrian\"];""",
    ),
    (
        """out center 100;""",
        """out center 180;""",
    ),
    (
        """    .slice(0, 24);""",
        """    .slice(0, 40);""",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'expected block not found:\n{old[:160]}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
