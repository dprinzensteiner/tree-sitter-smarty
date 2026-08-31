; ---------------------------------------------------------------- delimiters
[
  "{"
  "}"
  "{/"
  "|"
] @punctuation.bracket

[
  ":"
  ","
] @punctuation.delimiter

"$" @punctuation.special

; ------------------------------------------------------------------ keywords
[
  "{if"
  "{elseif"
  "{else}"
  "{/if}"
  "{foreach"
  "{foreachelse}"
  "{/foreach}"
  "{section"
  "{sectionelse}"
  "{/section}"
  "{for"
  "{forelse}"
  "{/for}"
  "{while"
  "{/while}"
  "{literal}"
  "{/literal}"
  "as"
  "to"
  "step"
] @keyword

; Tag names: {assign}, {include}, {capture}, and user plugins alike.
(tag_name) @function
(end_tag) @keyword
(flag) @attribute

; ----------------------------------------------------------------- operators
[
  "=>"
  "="
  "&&"
  "||"
  "and"
  "or"
  "not"
  "!"
  "=="
  "!="
  "==="
  "!=="
  "<>"
  "eq"
  "ne"
  "neq"
  "<"
  ">"
  "<="
  ">="
  "lt"
  "gt"
  "lte"
  "le"
  "gte"
  "ge"
  "+"
  "-"
  "*"
  "/"
  "%"
  "mod"
  "."
] @operator

; ----------------------------------------------------------------- variables
(variable "$" @punctuation.special)
(variable (identifier) @variable)

(attribute name: (attribute_name) @property)
(array_pair key: (string) @property)

; ----------------------------------------------------------------- functions
(modifier "|" @punctuation.bracket)
(modifier name: (modifier_name) @function)
(function_call name: (function_name) @function)

; ------------------------------------------------------------------ literals
(string) @string
(string_content) @string
(number) @number
(boolean) @constant
(qualified_name) @constant

; Backticked `$var` interpolation inside a double-quoted string.
(interpolation) @embedded
(interpolation "`" @punctuation.special)

(comment) @comment
