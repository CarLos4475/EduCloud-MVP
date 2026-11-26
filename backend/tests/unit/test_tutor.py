import json

import pytest
from campus.services.academic import DomainError
from test_materials import setup_study, upload_note


class StudyProvider:
    def __init__(self, invented=False):
        self.invented = invented
        self.calls = 0

    def tutor_answer(self, messages, on_progress=None):
        import json

        self.calls += 1
        if not json.loads(messages[-1]["content"])["sources"]:
            return {
                "answer": "No encontré eso en tus apuntes.",
                "citations": [],
                "insufficientSources": True,
            }, {"total_tokens": 20}
        return {
            "answer": "Con corriente fija, V = IR.",
            "citations": [
                {"sourceId": "invented" if self.invented else "S1", "quote": "V = I R"}
            ],
            "insufficientSources": False,
        }, {"total_tokens": 30}


def test_tutor_is_scoped_idempotent_recovers_and_requires_source_consent(tmp_path):
    from campus.services.retrieval import RetrievalService
    from campus.services.tutoring import TutorService

    records, subject, jobs, _, materials, uploads = setup_study(tmp_path)
    ticket, upload = upload_note(uploads, subject)
    materials.ingest(jobs.claim("alice", upload["job"]["id"]))
    provider = StudyProvider()
    tutor = TutorService(records, jobs, RetrievalService(materials), provider)
    conversation = tutor.create(
        "alice",
        {
            "subjectId": subject["id"],
            "title": "Dudas",
            "personalityId": "socratic",
            "assistanceMode": "solution",
            "materialIds": [ticket["materialId"]],
            "sourceMode": "selected_material",
            "preferences": "",
        },
    )
    accepted = tutor.send(
        "alice",
        conversation["id"],
        {"question": "resistencia y corriente V", "allowGeneralForTurn": False},
        "same-turn",
    )
    assert (
        tutor.send(
            "alice",
            conversation["id"],
            {"question": "resistencia y corriente V", "allowGeneralForTurn": False},
            "same-turn",
        )["id"]
        == accepted["id"]
    )
    tutor.run(jobs.claim("alice", accepted["jobId"]))
    restored = tutor.turn("alice", accepted["id"])
    assert (
        restored["status"] == "succeeded"
        and restored["citations"][0]["materialId"] == ticket["materialId"]
    )
    assert provider.calls == 1
    material = materials.get("alice", ticket["materialId"])
    materials.revise(
        "alice",
        material["id"],
        material["revision"],
        [
            {
                "blockId": "block-1",
                "text": "Ley de Ohm: V = I R. Resistencia y corriente.",
            }
        ],
        [],
    )
    assert tutor.turn("alice", accepted["id"])["sourcesChanged"] is True
    with pytest.raises(DomainError):
        tutor.turn("bob", accepted["id"])
    no_source = tutor.send(
        "alice",
        conversation["id"],
        {"question": "mitocondria ADN", "allowGeneralForTurn": False},
        "next-turn",
    )
    tutor.run(jobs.claim("alice", no_source["jobId"]))
    assert tutor.turn("alice", no_source["id"])["needsConsent"] is True
    assert provider.calls == 2


def test_provider_cannot_publish_invented_citations(tmp_path):
    from campus.services.retrieval import RetrievalService
    from campus.services.tutoring import TutorService

    records, subject, jobs, _, materials, uploads = setup_study(tmp_path)
    ticket, uploaded = upload_note(uploads, subject)
    materials.ingest(jobs.claim("alice", uploaded["job"]["id"]))
    tutor = TutorService(
        records, jobs, RetrievalService(materials), StudyProvider(invented=True)
    )
    conversation = tutor.create(
        "alice",
        {
            "subjectId": subject["id"],
            "title": "Duda",
            "materialIds": [ticket["materialId"]],
        },
    )
    turn = tutor.send(
        "alice",
        conversation["id"],
        {"question": "resistencia", "allowGeneralForTurn": False},
        "invented",
    )
    with pytest.raises(DomainError) as invalid:
        tutor.run(jobs.claim("alice", turn["jobId"]))
    assert invalid.value.status == 422
    assert tutor.turn("alice", turn["id"])["citations"] == []


def test_interrupted_provider_requires_explicit_retry_charge_consent(tmp_path):
    from campus.adapters.deepseek import ProviderFailure
    from campus.api.study_runtime import StudyRuntime

    class TimeoutProvider:
        def tutor_answer(self, *args, **kwargs):
            raise ProviderFailure("provider_timeout")

    records, subject, _jobs, objects, _materials, _uploads = setup_study(tmp_path)
    state = StudyRuntime(records, objects, b"test-key", TimeoutProvider())
    ticket, uploaded = upload_note(state.uploads, subject)
    state.run_job(uploaded["job"])
    conv = state.tutor.create(
        "alice", {"subjectId": subject["id"], "materialIds": [ticket["materialId"]]}
    )
    turn = state.tutor.send(
        "alice",
        conv["id"],
        {"question": "resistencia", "allowGeneralForTurn": False},
        "timeout",
    )
    state.run_job(state.jobs.get("alice", turn["jobId"]))
    assert state.tutor.turn("alice", turn["id"])["usageUnknown"] is True
    with pytest.raises(DomainError):
        state.retry("alice", turn["jobId"])
    new_job = state.retry("alice", turn["jobId"], True)
    assert state.tutor.turn("alice", turn["id"])["jobId"] == new_job["id"]


class RecordingProvider:
    def __init__(self):
        self.requests = []

    def tutor_answer(self, messages, on_progress=None):
        self.requests.append(messages)
        return {
            "answer": f"Respuesta {len(self.requests)}.",
            "citations": [],
            "insufficientSources": False,
        }, {"total_tokens": 20}


def test_tutor_gets_persona_length_student_context_and_real_turn_sequence(tmp_path):
    from campus.services.retrieval import RetrievalService
    from campus.services.tutoring import TutorService

    records, subject, jobs, _, materials, _ = setup_study(tmp_path)
    records.save(
        "alice",
        "profiles",
        "me",
        {
            "id": "me",
            "revision": 1,
            "displayName": "Valeria Pérez",
            "career": "Matemáticas Aplicadas y Computación",
            "timezone": "America/Mexico_City",
        },
        None,
    )
    records.save(
        "alice",
        "topics",
        "t1",
        {
            "id": "t1",
            "revision": 1,
            "subjectId": subject["id"],
            "title": "Ley de Ohm",
            "order": 1,
        },
        None,
    )
    provider = RecordingProvider()
    tutor = TutorService(records, jobs, RetrievalService(materials), provider)
    conversation = tutor.create(
        "alice",
        {
            "subjectId": subject["id"],
            "personalityId": "direct",
            "assistanceMode": "hints",
            "responseLength": "brief",
            "sourceMode": "general",
        },
    )

    def ask(question, key):
        turn = tutor.send(
            "alice",
            conversation["id"],
            {"question": question, "allowGeneralForTurn": True},
            key,
        )
        tutor.run(jobs.claim("alice", turn["jobId"]))

    ask("Hola", "k1")
    ask("¿Qué es un voltaje?", "k2")
    first, second = provider.requests
    system = first[0]["content"]
    assert "Al grano" in system and "Pistas" in system and "breve" in system
    reference = first[1]["content"]
    assert "Valeria" in reference and "Pérez" not in reference
    assert "Matemáticas Aplicadas" in reference and "Ley de Ohm" in reference
    assert subject["name"] in reference
    # Second request: the ordered recent exchange travels with the question, format reminder included.
    assert [m["role"] for m in second] == ["system", "user", "user"]
    current = json.loads(second[-1]["content"])
    assert current["conversacionReciente"] == [
        {"estudiante": "Hola", "tutor": "Respuesta 1."}
    ]
    assert current["question"] == "¿Qué es un voltaje?"
    assert "JSON" in current["formato"]


def test_unreadable_provider_output_is_retried_once_when_the_cost_is_known(tmp_path):
    from campus.adapters.deepseek import ProviderFailure
    from campus.services.retrieval import RetrievalService
    from campus.services.tutoring import TutorService

    class Flaky:
        def __init__(self):
            self.calls = 0

        def tutor_answer(self, messages, on_progress=None):
            self.calls += 1
            if self.calls == 1:
                raise ProviderFailure("provider_invalid_output", {"total_tokens": 25})
            return {
                "answer": "Listo.",
                "citations": [],
                "insufficientSources": False,
            }, {"total_tokens": 30}

    records, subject, jobs, _, materials, _ = setup_study(tmp_path)
    provider = Flaky()
    tutor = TutorService(records, jobs, RetrievalService(materials), provider)
    chat = tutor.create("alice", {"subjectId": subject["id"], "sourceMode": "general"})
    turn = tutor.send(
        "alice", chat["id"], {"question": "Hola", "allowGeneralForTurn": True}, "r1"
    )
    tutor.run(jobs.claim("alice", turn["jobId"]))
    done = tutor.turn("alice", turn["id"])
    assert provider.calls == 2 and done["status"] == "succeeded"
    assert done["usage"]["total_tokens"] == 55


def test_suggested_actions_are_validated_deduplicated_and_dropped_when_consent_is_needed(
    tmp_path,
):
    from campus.services.retrieval import RetrievalService
    from campus.services.tutoring import TutorService

    class Suggesting:
        def __init__(self, insufficient=False):
            self.insufficient = insufficient

        def tutor_answer(self, messages, on_progress=None):
            return {
                "answer": "Listo.",
                "citations": [],
                "insufficientSources": self.insufficient,
                "actions": [
                    {
                        "type": "flashcards",
                        "label": "Tarjetas",
                        "instruction": "Sobre Ohm",
                    },
                    {"type": "flashcards", "label": "Repetida", "instruction": "Otra"},
                    {"type": "borrar_todo", "label": "Mala", "instruction": "x"},
                    {"type": "quiz", "label": "", "instruction": "x"},
                    {
                        "type": "quiz",
                        "label": "Cuestionario",
                        "instruction": "Sobre Ohm",
                    },
                    {
                        "type": "interactive",
                        "label": "Experimento",
                        "instruction": "Ohm",
                    },
                ],
            }, {"total_tokens": 20}

    def ask(provider, key):
        records, subject, jobs, _, materials, _ = setup_study(tmp_path / key)
        tutor = TutorService(records, jobs, RetrievalService(materials), provider)
        chat = tutor.create(
            "alice", {"subjectId": subject["id"], "sourceMode": "general"}
        )
        turn = tutor.send(
            "alice", chat["id"], {"question": "Hola", "allowGeneralForTurn": True}, key
        )
        tutor.run(jobs.claim("alice", turn["jobId"]))
        return tutor.turn("alice", turn["id"])

    done = ask(Suggesting(), "a")
    assert [a["type"] for a in done["actions"]] == ["flashcards", "quiz"]
    assert done["actions"][0]["label"] == "Tarjetas"
    # Without consent to use general knowledge, an unsupported answer offers no actions.
    records, subject, jobs, _, materials, _ = setup_study(tmp_path / "b")
    tutor = TutorService(records, jobs, RetrievalService(materials), Suggesting(True))
    chat = tutor.create(
        "alice", {"subjectId": subject["id"], "sourceMode": "selected_material"}
    )
    turn = tutor.send(
        "alice",
        chat["id"],
        {"question": "mitocondria", "allowGeneralForTurn": False},
        "b",
    )
    tutor.run(jobs.claim("alice", turn["jobId"]))
    assert tutor.turn("alice", turn["id"])["actions"] == []


def test_action_buttons_are_not_offered_every_turn_unless_the_student_asks():
    from campus.services.tutoring import TutorService

    offered = [{"question": "q", "answer": "a", "actions": ["quiz"]}]
    plain = [{"question": "q", "answer": "a", "actions": []}]
    assert TutorService._too_soon({"question": "¿y la potencia?", "history": offered})
    assert not TutorService._too_soon({"question": "¿y la potencia?", "history": plain})
    assert not TutorService._too_soon(
        {"question": "quiero practicar", "history": offered}
    )
    assert not TutorService._too_soon(
        {"question": "Hazme TARJETAS", "history": offered}
    )
