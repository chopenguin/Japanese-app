# Data Sources

This project stores JLPT vocabulary as app-ready JSON under `data/vocabulary`.

## JLPT vocabulary, kana, and English glosses

- Source: OpenJLPT
- URL: https://github.com/evanclan/OpenJLPT
- License: CC BY-SA 4.0
- Used for: JLPT level grouping, Japanese display form, kana readings, English glosses, examples.

OpenJLPT itself attributes JLPT level assignments to Jonathan Waller's community JLPT
resources and dictionary fields to EDRDG/JMdict data. JLPT vocabulary lists are unofficial:
the JLPT organization does not publish official N5-N1 word lists.

## Traditional Chinese glosses

- Source: NihongDict
- URL: https://github.com/carlcc/NihongDict
- License: no license file found in the repository at import time.
- Used for: initial Chinese meaning matches where an exact Japanese headword/reading match
  was available.

Because the NihongDict repository does not provide a clear license, treat
`meanings_zh` as development seed data that should be reviewed or replaced with a clearly
licensed Japanese-Chinese dictionary before public redistribution as product data.

The source glosses are simplified Chinese. The build script converts them to Taiwan
traditional Chinese with OpenCC (`opencc-js`).

## Missing Chinese gloss overrides

- File: `data/vocabulary/translation-overrides.zh-TW.json`
- Used for: entries that had no exact NihongDict match.

These overrides were generated from the OpenJLPT English glosses using a public translation
endpoint and manual corrections for obvious source errors such as `せっけん` ("soap").
They are meant to make the app dataset complete for development, but should still be
reviewed before production release.

## Generated structure

Each word lives in its own folder:

```text
data/vocabulary/
  N5/
    0001_あさって/
      entry.json
  N4/
  N3/
  N2/
  N1/
  manifest.json
```

Each `entry.json` reserves fields for future audio:

```json
{
  "kanji": "食べる",
  "kana": "たべる",
  "meanings_zh": ["吃", "生活"],
  "audio": {
    "status": "pending",
    "files": []
  }
}
```
