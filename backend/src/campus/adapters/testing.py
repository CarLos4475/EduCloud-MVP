"""Explicit emulator-only provider for repeatable browser tests; never a fallback."""

import json


class TestStudyProvider:
    __test__ = False

    def transcribe_image(self, content, media_type="image/png"):
        from campus.adapters.deepseek import Transcription

        return Transcription(text="Transcripción de prueba local: V = I R."), {
            "total_tokens": 30
        }

    def structured_answer(
        self, messages, on_progress=None, max_tokens=6000, json_mode=True
    ):
        context = json.loads(messages[-1]["content"])
        source = context["sources"][0] if context["sources"] else None
        quote = source["text"][:80] if source else ""
        citations = [{"sourceId": source["sourceId"], "quote": quote}] if source else []
        kind = context["kind"]
        note = "Proveedor de prueba local. "
        if kind == "summary":
            body = {
                "overview": note + "Resumen de ejemplo.",
                "sections": [
                    {"heading": "Idea principal", "body": quote or "Ejemplo."}
                ],
                "keyPoints": ["Punto uno", "Punto dos"],
            }
        elif kind == "concepts":
            body = {"concepts": [{"term": "Ley de Ohm", "definition": "$V = IR$"}]}
        elif kind == "flashcards":
            body = {
                "cards": [{"front": "¿Qué dice la ley de Ohm?", "back": "$V = IR$"}]
            }
        elif kind == "quiz":
            body = {
                "questions": [
                    {
                        "prompt": "Si R = 2 y I = 3, ¿cuánto vale V?",
                        "options": ["1", "5", "6", "9"],
                        "correctIndex": 2,
                        "explanation": "V = I R = 6.",
                    }
                ]
            }
        elif kind == "exercises":
            body = {
                "exercises": [
                    {
                        "type": "complete",
                        "prompt": "La unidad de la resistencia es el ___.",
                        "answer": "ohmio",
                        "hints": ["Piensa en la letra griega Ω."],
                        "explanation": "La resistencia se mide en ohmios.",
                    },
                    {
                        "type": "order",
                        "prompt": "Ordena los pasos para calcular el voltaje.",
                        "steps": [
                            "Identifica la corriente y la resistencia",
                            "Escribe V = I R",
                            "Sustituye los valores",
                            "Calcula el producto",
                        ],
                        "hints": ["Empieza por los datos."],
                        "explanation": "Primero los datos, luego la fórmula y al final el cálculo.",
                    },
                    {
                        "type": "open",
                        "prompt": "Si I = 2 A y R = 3 Ω, ¿cuánto vale V?",
                        "answer": "V = 6 V",
                        "hints": ["Usa V = I R."],
                        "explanation": "V = 2 × 3 = 6 V.",
                    },
                ]
            }
        elif kind == "connections":
            body = {
                "pairs": [
                    {
                        "left": "Voltaje",
                        "right": "V = I R",
                        "why": "La ley de Ohm relaciona voltaje, corriente y resistencia.",
                    },
                    {
                        "left": "Resistencia",
                        "right": "Se mide en ohmios",
                        "why": "Su unidad en el SI es el ohmio (Ω).",
                    },
                    {
                        "left": "Potencia",
                        "right": "P = I² R",
                        "why": "La potencia disipada crece con el cuadrado de la corriente.",
                    },
                ]
            }
        else:
            meta = {
                "title": "Explorador de la ley de Ohm",
                "learningObjective": "Ver cómo cambia el voltaje con la resistencia.",
                "instructions": "Mueve la resistencia.",
                "textAlternative": "Una gráfica lineal de V frente a I; su pendiente es R.",
                "studyGuide": "V = I R: a corriente fija, el voltaje crece con la resistencia.",
                "initialState": {"r": 5},
                "citations": citations,
            }
            html = (
                '<div class="ec-stage"><div id="plot"></div></div>'
                '<div class="ec-panel"><div class="ec-field"><div class="ec-field-head">'
                '<label for="r">Resistencia</label><output class="ec-val" id="rv">5 Ω</output></div>'
                '<input id="r" type="range" min="1" max="10" value="5"></div></div>'
            )
            js = (
                'const r = EC.$("#r"); if (typeof EC.state.r === "number") EC.set(r, EC.state.r);'
                'const ch = EC.chart("#plot", {xDomain:[0,3], yDomain:[0,30]});'
                "function up(){const R=Number(r.value);EC.$('#rv').textContent=R+' Ω';"
                "ch.set({series:[{id:'v',fn:x=>R*x}]});EC.save({r:R});}"
                'r.addEventListener("input", up); up();'
            )
            if "dibuj" in str(context.get("instruction", "")).lower():
                meta["title"] = "Predice la gráfica dibujando"
                meta["initialState"] = {}
                html = (
                    '<div id="pad"></div>'
                    '<div class="ec-row"><button id="show">Ver la curva real</button>'
                    '<button id="hide" class="alt">Ocultar la curva</button></div>'
                )
                js = (
                    'const pad = EC.sketch("#pad", {id:"pad", x:[0,3], y:[0,15],'
                    ' xLabel:"I (A)", yLabel:"V (V)",'
                    ' hint:"Dibuja cómo crees que cambia V al aumentar I",'
                    ' layers:[{id:"real", label:"Valor real: V = 5 I", fn:x=>5*x, color:"s4"}],'
                    ' choices:[{label:"Recta que sube", fn:x=>5*x},'
                    ' {label:"Curva que se aplana", fn:x=>9*Math.sqrt(x/3)}]});'
                    'EC.$("#show").addEventListener("click", () => {'
                    ' pad.reveal("real"); EC.keep("shown", true); });'
                    'EC.$("#hide").addEventListener("click", () => {'
                    ' pad.hide("real"); EC.keep("shown", false); });'
                    'if (EC.state.shown) pad.reveal("real", {instant:true});'
                    "EC.save(EC.state);"
                )
            text = (
                f"=====META=====\n{json.dumps(meta, ensure_ascii=False)}\n"
                f"=====HTML=====\n{html}\n=====CSS=====\n\n=====JS=====\n{js}\n=====END=====\n"
            )
            return text, {"total_tokens": 40}
        return {**body, "citations": citations}, {"total_tokens": 40}

    def tutor_answer(self, messages, on_progress=None, max_tokens=3000):
        context = json.loads(messages[-1]["content"])
        source = context["sources"][0] if context["sources"] else None
        return {
            "answer": f"Proveedor de prueba local. {source['text'][:200] if source else 'Ejemplo de explicación general.'}",
            "citations": [
                {"sourceId": source["sourceId"], "quote": source["text"][:100]}
            ]
            if source
            else [],
            "insufficientSources": False,
            "actions": [
                {
                    "type": "flashcards",
                    "label": "Practicar con tarjetas",
                    "instruction": "Tarjetas sobre la ley de Ohm",
                }
            ]
            if source
            else [],
        }, {"total_tokens": 30}
