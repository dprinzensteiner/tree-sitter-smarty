# tree-sitter-smarty

Tree-sitter grammar for the [Smarty](https://www.smarty.net/) template language.

Forked from [Kibadda/tree-sitter-smarty](https://github.com/Kibadda/tree-sitter-smarty),
which covered `if`/`foreach`/`block`/`include`/`nocache` and bare `{$output}`.
Measured against 400 real-world templates, the upstream grammar parsed 22% of
files without errors; this fork parses 93%.

## What was added

- **A real expression grammar.** Operators with precedence, arrays, function
  calls, PHP-qualified names (`\Efront\Model\Content::TYPE_EVENT`), and
  modifiers that apply to any expression rather than only to tag attributes, so
  `{if $level == 'Foo::BAR'|constant}` parses.
- **Nested tags inside expressions**, which upstream could not express at all:
  ```smarty
  {assign var='cfg' value=['name' => {"Name"|translate}]}
  ```
- **The rest of the tag set**: `assign`, `append`, `capture`, `function`,
  `section`, `for`, `while`, `strip`, `extends`, `cycle`, `literal`, plus the
  `{$var = ...}` assignment shorthand and trailing `nofilter`/`nocache` flags.
- **Generic tags.** Unknown tags parse as `tag`, so user-defined plugins work
  without the grammar knowing their names. Unknown *block* plugins parse as an
  opening `tag` plus a `close_tag`: flatter than a real nesting, but error-free.
- **Auto-literal.** Smarty treats `{` followed by whitespace as text, not a tag.
  Honouring that (and the same for `{}`, `{(`, …) is what lets JavaScript and
  CSS survive inside a template: `if (x) {`, `}catch(e){}`, `.a { color: red }`.

## Known gaps

- A `{` immediately followed by a letter is a tag, so unspaced CSS
  (`.a {color: red}`) still mis-parses. Smarty itself has this ambiguity; use
  `{literal}` or a space.
- No `$i++`, and no `is even` / `is div by` operators.
- Unknown block plugins do not nest, so folding and indentation treat their
  bodies as flat.

## Development

```sh
tree-sitter generate
tree-sitter test
```
