[
  (if_statement)
  (elseif_clause)
  (else_clause)
  (foreach_statement)
  (foreachelse_clause)
  (section_statement)
  (sectionelse_clause)
  (for_statement)
  (forelse_clause)
  (while_statement)
  (block_statement)
  (literal_statement)
  (array)
] @indent

[
  "{/if}"
  "{/foreach}"
  "{/section}"
  "{/for}"
  "{/while}"
  "{/literal}"
  "]"
  (end_tag)
] @outdent

; else/elseif close the previous branch and open a new one.
[
  "{else}"
  "{elseif"
  "{foreachelse}"
  "{sectionelse}"
  "{forelse}"
] @outdent
