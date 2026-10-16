"""Synthetic-only tests for local structured import; no external AI calls."""
from io import BytesIO

from docx import Document
from fastapi.testclient import TestClient

from alinha_api.main import app
from alinha_api.services.structured_import import draft_profile

CV = """Pessoa Exemplo
pessoa@exemplo.test
Resumo profissional
Desenvolvedora com experiência fictícia em APIs Python.
Experiência profissional
Desenvolvedora Backend — Empresa Fictícia — 2024–2026
- Desenvolveu APIs REST em Python e FastAPI.
- Criou testes de integração usando pytest.
Formação acadêmica
Bacharelado em Tecnologia — Instituição Exemplo — 2020–2024
Projetos
Projeto Exemplo: Uma API fictícia com documentação e testes.
Competências
Python, FastAPI, SQL
Idiomas
Português, Inglês intermediário
"""


def test_draft_literals_without_new_claims():
    preview = draft_profile(CV)
    profile = preview.profile
    assert profile.contact.name == "Pessoa Exemplo"
    assert profile.contact.email == "pessoa@exemplo.test"
    assert len(profile.experiences) == 1
    assert profile.experiences[0].role == "Desenvolvedora Backend"
    assert profile.experiences[0].organization == "Empresa Fictícia"
    assert profile.experiences[0].highlights[0] == "Desenvolveu APIs REST em Python e FastAPI."
    assert profile.education[0].institution == "Instituição Exemplo"
    assert profile.projects[0].description == "Uma API fictícia com documentação e testes."
    assert profile.skills == ["Python", "FastAPI", "SQL"]
    assert "Kubernetes" not in str(profile.model_dump())
    assert preview.requires_confirmation is True


def test_unknown_sections_are_retained_for_review():
    text = """Pessoa Fictícia
Introdução não reconhecida com algum texto descritivo.
Experiência profissional
Atuei em atividades diversas que não seguem o formato cargo e empresa.
Competências
Python, Git
"""
    result = draft_profile(text)
    assert result.unassigned_lines
    assert any("Atuei" in line for line in result.unassigned_lines)
    assert result.profile.experiences == []


def test_import_upload_docx_without_persistence():
    document = Document()
    for line in CV.splitlines():
        document.add_paragraph(line)
    output = BytesIO()
    document.save(output)
    client = TestClient(app)
    result = client.post(
        "/api/v1/resumes/structured/import/upload",
        files={"file": ("ficticio.docx", output.getvalue(),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert result.status_code == 200
    data = result.json()
    assert data["requires_confirmation"] is True
    assert data["profile"]["skills"] == ["Python", "FastAPI", "SQL"]
    assert data["profile"]["contact"]["email"] == "pessoa@exemplo.test"
    assert data["source_text"].startswith("Pessoa Exemplo")
    assert result.headers.get("set-cookie") is None


def test_import_upload_txt_and_reject_unsupported_files():
    client = TestClient(app)
    result = client.post(
        "/api/v1/resumes/structured/import/upload",
        files={"file": ("cv.txt", CV.encode(), "text/plain")},
    )
    assert result.status_code == 200
    bad = client.post(
        "/api/v1/resumes/structured/import/upload",
        files={"file": ("cv.exe", CV.encode(), "application/octet-stream")},
    )
    assert bad.status_code == 422



def test_labeled_contact_fields_and_pipe_experience_separator():
    text = """Nome: Pessoa Fictícia
Telefone: (11) 99999-0000
Cidade: Cidade Exemplo, SP
LinkedIn: https://linkedin.com/in/ficcional
pessoa@exemplo.test
Experiência profissional
Pessoa Desenvolvedora | Empresa de Teste | 2023 - 2026
- Criou APIs em Python.
Competências
Python | SQL
"""
    draft = draft_profile(text)
    assert draft.profile.contact.name == "Pessoa Fictícia"
    assert draft.profile.contact.phone == "(11) 99999-0000"
    assert draft.profile.contact.city == "Cidade Exemplo, SP"
    assert draft.profile.contact.links == ["https://linkedin.com/in/ficcional"]
    assert draft.profile.experiences[0].organization == "Empresa de Teste"
    assert draft.profile.skills == ["Python", "SQL"]


def test_excess_experience_highlights_remain_visible_for_review():
    text = (
        "Pessoa Fictícia\nExperiência profissional\n"
        "Desenvolvedora — Empresa de Teste — 2024 - 2026\n"
        + "\n".join(f"- Atividade fictícia número {index}" for index in range(13))
    )
    draft = draft_profile(text)
    assert len(draft.profile.experiences[0].highlights) == 10
    assert any("número 12" in line for line in draft.unassigned_lines)
