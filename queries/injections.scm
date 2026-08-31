; Smarty templates are HTML with Smarty tags interleaved. The grammar leaves
; that HTML in opaque `text` leaves, so HTML is injected into them.
;
; `injection.combined` is essential: it concatenates every captured range into a
; single HTML parse, so elements that straddle a Smarty tag still match up, e.g.
;   <a href="{$url}">   ->   <a href="">
;   <div {if $a}class="x"{/if}>   ->   <div class="x">
; Without it each text node parses standalone and every tag split by a Smarty
; tag becomes an error.
;
; Because the HTML layer carries its own injections, <script> and <style>
; contents reach the JavaScript and CSS grammars from there.

((text) @injection.content
  (#set! injection.language "html")
  (#set! injection.combined))

; {literal} bodies are raw and usually wrap markup or a script block, so they
; belong to the same HTML document as the surrounding text.
((raw_text) @injection.content
  (#set! injection.language "html")
  (#set! injection.combined))
