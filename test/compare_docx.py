"""Compare the browser-engine .docx with the native-app .docx.

Checks page geometry, paragraph styles and run fonts so a port regression shows
up as an explicit difference instead of a silent drift.

    python test/compare_docx.py
"""

import json
import os
import sys

import docx

HERE = os.path.dirname(os.path.abspath(__file__))
JS_DIR = os.path.join(HERE, 'out')
CS_DIR = os.path.join(HERE, 'out-cli', 'all')
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def east_asia(run):
    rpr = run._element.find(W + 'rPr')
    if rpr is None:
        return None
    fonts = rpr.find(W + 'rFonts')
    return None if fonts is None else fonts.get(W + 'eastAsia')


def style_of(paragraph):
    pf = paragraph.paragraph_format
    run = paragraph.runs[0] if paragraph.runs else None
    line = pf.line_spacing
    return {
        'text': (paragraph.text or '')[:18],
        'font': east_asia(run) if run is not None else None,
        'size': round(run.font.size.pt, 1) if run is not None and run.font.size else None,
        'bold': run.font.bold if run is not None else None,
        'align': str(pf.alignment) if pf.alignment is not None else None,
        'indent': round(pf.first_line_indent.pt, 1) if pf.first_line_indent else None,
        'line': round(line.pt, 1) if hasattr(line, 'pt') else line,
        'before': round(pf.space_before.pt, 1) if pf.space_before else None,
        'after': round(pf.space_after.pt, 1) if pf.space_after else None,
    }


def summary(path):
    document = docx.Document(path)
    section = document.sections[0]
    return {
        'page': [
            round(section.page_width.mm, 1), round(section.page_height.mm, 1),
            round(section.top_margin.mm, 1), round(section.bottom_margin.mm, 1),
            round(section.left_margin.mm, 1), round(section.right_margin.mm, 1),
        ],
        'paragraphs': [style_of(p) for p in document.paragraphs],
    }


def main():
    presets = sys.argv[1:] or ['gov', 'paper', 'report', 'resume']
    failures = 0
    report = {}
    for preset in presets:
        js_path = os.path.join(JS_DIR, preset + '.docx')
        cs_path = os.path.join(CS_DIR, preset + '.docx')
        if not os.path.exists(js_path) or not os.path.exists(cs_path):
            print(f'{preset}: missing file ({js_path} / {cs_path})')
            failures += 1
            continue
        js = summary(js_path)
        cs = summary(cs_path)
        diffs = []
        if js['page'] != cs['page']:
            diffs.append(f'page {js["page"]} != {cs["page"]}')
        if len(js['paragraphs']) != len(cs['paragraphs']):
            diffs.append(f'paragraph count {len(js["paragraphs"])} != {len(cs["paragraphs"])}')
        for index, (a, b) in enumerate(zip(js['paragraphs'], cs['paragraphs'])):
            if a != b:
                keys = [k for k in a if a[k] != b.get(k)]
                diffs.append(f'para {index} {a["text"]!r}: ' + ', '.join(f'{k} {a[k]!r}->{b.get(k)!r}' for k in keys))
        report[preset] = {'ok': not diffs, 'diffs': diffs[:8], 'paragraphs': len(cs['paragraphs'])}
        print(f'== {preset}: ' + ('identical' if not diffs else f'{len(diffs)} difference(s)'))
        for diff in diffs[:8]:
            print('   -', diff)
        failures += 1 if diffs else 0

    with open(os.path.join(HERE, 'compare-report.json'), 'w', encoding='utf-8') as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
    print('\nRESULT:', 'all compared presets identical' if failures == 0 else f'{failures} preset(s) differ')
    return 0 if failures == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
