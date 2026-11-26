"""逐段比对两个 .docx（文字 + 字体 + 字号 + 对齐 + 缩进 + 行距）。

    python test/compare_text.py a.docx b.docx
"""

import sys

import docx

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'


def east_asia(run):
    rpr = run._element.find(W + 'rPr')
    if rpr is None:
        return None
    fonts = rpr.find(W + 'rFonts')
    return None if fonts is None else fonts.get(W + 'eastAsia')


def describe(path):
    document = docx.Document(path)
    section = document.sections[0]
    rows = [(
        round(section.page_width.mm, 1), round(section.page_height.mm, 1),
        round(section.top_margin.mm, 1), round(section.bottom_margin.mm, 1),
        round(section.left_margin.mm, 1), round(section.right_margin.mm, 1),
    )]
    paragraphs = []
    for paragraph in document.paragraphs:
        run = paragraph.runs[0] if paragraph.runs else None
        line = paragraph.paragraph_format.line_spacing
        paragraphs.append({
            'text': paragraph.text,
            'font': east_asia(run) if run is not None else None,
            'size': round(run.font.size.pt, 1) if run is not None and run.font.size else None,
            'align': str(paragraph.paragraph_format.alignment),
            'indent': round(paragraph.paragraph_format.first_line_indent.pt, 1)
            if paragraph.paragraph_format.first_line_indent else None,
            'line': round(line.pt, 1) if hasattr(line, 'pt') else line,
        })
    return rows[0], paragraphs


def main():
    if len(sys.argv) < 3:
        print('usage: python test/compare_text.py a.docx b.docx')
        return 2
    page_a, a = describe(sys.argv[1])
    page_b, b = describe(sys.argv[2])
    print('page:', 'same' if page_a == page_b else 'DIFF  %s vs %s' % (page_a, page_b))
    print('paragraphs:', len(a), 'vs', len(b))

    diffs = 0
    for index in range(max(len(a), len(b))):
        left = a[index] if index < len(a) else None
        right = b[index] if index < len(b) else None
        if left != right:
            diffs += 1
            print('  para %d differs:' % index)
            for key in ('text', 'font', 'size', 'align', 'indent', 'line'):
                lv = None if left is None else left.get(key)
                rv = None if right is None else right.get(key)
                if lv != rv:
                    print('    %-6s %r -> %r' % (key, lv, rv))
            if diffs >= 10:
                print('  ... more differences omitted')
                break

    if page_a == page_b and diffs == 0:
        print('RESULT: identical (%d paragraphs)' % len(a))
        return 0
    print('RESULT: %d difference(s)' % diffs)
    return 1


if __name__ == '__main__':
    sys.exit(main())
