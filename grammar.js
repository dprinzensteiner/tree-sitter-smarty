/**
 * Smarty template grammar.
 *
 * Extends Kibadda/tree-sitter-smarty, which covered only
 * if/foreach/block/include/nocache plus bare {$output}. This adds the rest of
 * the tag set, a real expression grammar (so nested {...} inside attribute
 * values parse), and generic handling of unknown plugin tags.
 *
 * Two rules do most of the heavy lifting:
 *
 *  - Auto-literal. Smarty treats `{` followed by whitespace as literal text,
 *    not a tag. Honouring that is what lets JavaScript and CSS survive inside
 *    a template: `if (x) {`, `.a { color: red }` are text, not Smarty tags.
 *
 *  - Generic tags. Paired tags are a known finite set, so they get explicit
 *    rules. Everything else is a `tag`, which means user plugins parse without
 *    the grammar knowing their names.
 */

// Tags that come in {x}...{/x} pairs. Anything not here is standalone.
const BLOCK_TAGS = [
  'capture', 'function', 'strip', 'block', 'nocache',
  'textformat', 'php',
];

module.exports = grammar({
  name: 'smarty',

  // Whitespace is skipped between tokens so tags may be spaced and wrapped
  // freely. `text` still absorbs interior and trailing whitespace itself,
  // since its token matches any run not containing `{`; only whitespace
  // directly following a tag is dropped.
  extras: $ => [/[ \t\r\n]/],

  rules: {
    template: $ => repeat($._node),

    _node: $ => choice(
      $.comment,
      $.literal_statement,
      $.if_statement,
      $.foreach_statement,
      $.section_statement,
      $.for_statement,
      $.while_statement,
      $.block_statement,
      $.tag,
      $.close_tag,
      $.output,
      $.text,
    ),

    body: $ => repeat1($._node),

    // ---------------------------------------------------------------- text

    // Any run without `{`, plus any `{` that Smarty's auto-literal rule makes
    // ordinary text (one followed by whitespace). Low precedence so real tags
    // always win.
    // A `{` only starts a Smarty construct when followed by an identifier,
    // `$`, a quote, `/` or `*`. Smarty's own auto-literal rule says `{ ` is
    // text; the same logic covers `}catch(e){}` and `.a { color: red }`, which
    // is what keeps JavaScript and CSS inside a template readable.
    text: $ => token(prec(-1, repeat1(choice(
      /[^{]+/,
      /\{[^A-Za-z_$'"\/*]/,
    )))),

    comment: $ => seq('{*', alias(token(prec(-1, /[^*]*\*+([^}*][^*]*\*+)*/)), $.comment_content), '}'),

    // ------------------------------------------------------------- literal

    // Contents are raw: no Smarty parsing inside.
    literal_statement: $ => seq(
      '{literal}',
      optional(alias($._literal_content, $.raw_text)),
      '{/literal}',
    ),
    _literal_content: $ => token(prec(-1, repeat1(choice(
      /[^{]+/,
      /\{[^\/]/,
      /\{\/[^l]/,
    )))),

    // ---------------------------------------------------------- conditional

    if_statement: $ => seq(
      '{if', field('condition', $._expression), '}',
      field('body', optional($.body)),
      repeat(field('alternative', $.elseif_clause)),
      optional(field('alternative', $.else_clause)),
      '{/if}',
    ),
    elseif_clause: $ => seq(
      '{elseif', field('condition', $._expression), '}',
      field('body', optional($.body)),
    ),
    else_clause: $ => seq('{else}', field('body', optional($.body))),

    // -------------------------------------------------------------- loops

    // Modern `{foreach $a as $k => $v}` and legacy `{foreach from=$a item=v}`.
    foreach_statement: $ => seq(
      '{foreach',
      choice(
        seq(
          field('collection', $._expression),
          alias($._as, 'as'),
          field('key', $.variable),
          optional(seq('=>', field('value', $.variable))),
        ),
        repeat1($.attribute),
      ),
      '}',
      field('body', optional($.body)),
      optional(field('alternative', $.foreachelse_clause)),
      '{/foreach}',
    ),
    foreachelse_clause: $ => seq('{foreachelse}', field('body', optional($.body))),

    section_statement: $ => seq(
      '{section', repeat1($.attribute), '}',
      field('body', optional($.body)),
      optional(field('alternative', $.sectionelse_clause)),
      '{/section}',
    ),
    sectionelse_clause: $ => seq('{sectionelse}', field('body', optional($.body))),

    for_statement: $ => seq(
      '{for', repeat1(choice($.attribute, $._expression, 'to', 'step')), '}',
      field('body', optional($.body)),
      optional(field('alternative', $.forelse_clause)),
      '{/for}',
    ),
    forelse_clause: $ => seq('{forelse}', field('body', optional($.body))),

    while_statement: $ => seq(
      '{while', field('condition', $._expression), '}',
      field('body', optional($.body)),
      '{/while}',
    ),

    // ------------------------------------------------- generic paired tags

    // The close is a single literal token ('{/capture}'), not '{/' + name, so
    // the lexer can distinguish it from `close_tag`, which handles block tags
    // this grammar does not know about.
    block_statement: $ => choice(...BLOCK_TAGS.map(name => seq(
      '{', alias(name, $.tag_name), repeat(choice($.attribute, $._expression)), '}',
      field('body', optional($.body)),
      alias('{/' + name + '}', $.end_tag),
    ))),

    // ------------------------------------------------------ standalone tag

    // {assign var='x' value=$y}, {include file='a.tpl'}, and any plugin the
    // grammar has never heard of.
    // Precedence over `output`: `{foo}` is a plugin call in Smarty, not the
    // output of a bare constant.
    tag: $ => prec(1, seq(
      '{',
      alias($.identifier, $.tag_name),
      repeat(choice($.attribute, $._expression)),
      repeat($.flag),
      '}',
    )),

    attribute: $ => seq(
      field('name', alias($.identifier, $.attribute_name)),
      '=',
      field('value', $._attribute_value),
    ),
    _attribute_value: $ => $._expression,

    // ------------------------------------------------------------- output

    // {$var|escape}, {"text"|translate}, {$a.b->c}
    // {$x|escape}, {"text"|translate}, and Smarty's assignment shorthand
    // {$tabs = [...]}.
    output: $ => seq(
      '{',
      choice(field('assignment', $.assignment), field('expression', $._expression)),
      repeat($.flag),
      '}',
    ),

    // Trailing bare flags: {$x|@json_encode nofilter}
    flag: $ => choice('nofilter', 'nocache'),

    assignment: $ => seq(
      field('left', $.variable),
      '=',
      field('right', $._expression),
    ),

    // {/some_block_plugin}. Block tags the grammar knows get real nesting; a
    // user-defined one parses as an open `tag` and this close marker, which
    // keeps the tree flat but error-free rather than poisoning the whole file.
    close_tag: $ => seq('{/', alias($.identifier, $.tag_name), '}'),

    // `|@count` applies the modifier to the array itself rather than its
    // elements; the `@` is part of Smarty's syntax, not the name.
    // Right-associative so `:` arguments bind to the nearest modifier in a
    // chain like `$x|default:'-'|escape:'html'`.
    modifier: $ => prec.right(seq(
      '|',
      optional('@'),
      field('name', alias($.identifier, $.modifier_name)),
      repeat(seq(':', field('argument', $._expression))),
    )),

    // --------------------------------------------------------- expressions

    _expression: $ => choice(
      $.variable,
      $.string,
      $.number,
      $.boolean,
      $.array,
      $.function_call,
      $.qualified_name,
      $.identifier,
      $.output,             // nested {...}, e.g. value=[{"Name"|translate}]
      $.tag,                // a tag used as a value: 'data' => {include file=...}
      $.parenthesized_expression,
      $.unary_expression,
      $.binary_expression,
      $.filter_expression,
    ),

    // Modifiers apply to any expression, not only to a tag attribute:
    // `{if $level == 'Foo::BAR'|constant}` filters the string operand.
    // Binds tighter than every operator.
    filter_expression: $ => prec.left(8, seq(
      field('value', $._expression),
      repeat1($.modifier),
    )),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    // Binds tighter than every binary operator.
    unary_expression: $ => prec.right(7, seq(
      field('operator', choice('!', 'not', '-')),
      field('argument', $._expression),
    )),

    binary_expression: $ => {
      const table = [
        [1, choice('||', 'or')],
        [2, choice('&&', 'and')],
        [3, choice('==', '!=', '===', '!==', '<>', 'eq', 'ne', 'neq')],
        [4, choice('<', '>', '<=', '>=', 'lt', 'gt', 'lte', 'le', 'gte', 'ge')],
        [5, choice('+', '-', '.')],
        [6, choice('*', '/', '%', 'mod')],
      ];
      return choice(...table.map(([precedence, operator]) => prec.left(precedence, seq(
        field('left', $._expression),
        field('operator', operator),
        field('right', $._expression),
      ))));
    },

    function_call: $ => prec(2, seq(
      field('name', alias($.identifier, $.function_name)),
      '(',
      optional(seq($._expression, repeat(seq(',', $._expression)))),
      ')',
    )),

    variable: $ => prec.right(seq(
      '$',
      $.identifier,
      repeat(choice(
        seq('.', $.identifier),
        seq('->', $.identifier),
        seq('[', $._expression, ']'),
        seq('@', $.identifier),
      )),
    )),

    array: $ => seq(
      '[',
      optional(seq($._array_element, repeat(seq(',', $._array_element)), optional(','))),
      ']',
    ),
    _array_element: $ => choice($.array_pair, $._expression),
    array_pair: $ => seq(
      field('key', $._expression),
      '=>',
      field('value', $._expression),
    ),

    string: $ => choice(
      seq('"', repeat(choice($.interpolation, $._double_quoted_text)), '"'),
      seq("'", optional(alias(token.immediate(prec(1, /([^'\\]|\\.)+/)), $.string_content)), "'"),
    ),
    _double_quoted_text: $ => alias(token.immediate(prec(1, /([^"\\`]|\\.)+/)), $.string_content),
    // Smarty interpolates `$var` inside double quotes when backticked.
    interpolation: $ => seq('`', $._expression, '`'),

    number: $ => token(/-?\d+(\.\d+)?/),
    boolean: $ => choice('true', 'false', 'TRUE', 'FALSE', 'null', 'NULL'),
    // Fully-qualified PHP names appear bare in conditions:
    //   {if $t == \Efront\Model\Content::CONTENT_TYPE_EVENT}
    qualified_name: $ => token(prec(1,
      /\\?[A-Za-z_][A-Za-z0-9_]*(\\[A-Za-z_][A-Za-z0-9_]*)+(::[A-Za-z_][A-Za-z0-9_]*)?|[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*/)),

    _as: $ => token(/[aA][sS]/),

    identifier: $ => token(/[A-Za-z_][A-Za-z0-9_]*/),
  },
});
