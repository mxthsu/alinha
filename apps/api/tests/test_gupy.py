from alinha_api.agent.gupy import _job_url, _parse


def test_gupy_parse_brazilian_clt():
    result = _parse({
        "id": 42, "jobUrl": "https://empresa.gupy.io/jobs/42",
        "name": "Engenheiro de IA", "careerPageName": "Empresa Exemplo",
        "country": "Brasil", "city": "Florianópolis",
        "workplaceType": "hybrid", "type": "vacancy_type_effective",
        "description": "<p>Python &amp; IA</p>",
    })
    assert result is not None
    assert result.opportunity.source == "gupy"
    assert result.opportunity.contract_type == "clt"
    assert result.opportunity.work_mode == "hybrid"
    assert "Python & IA" in result.excerpt

def test_gupy_blocks_untrusted_or_foreign_urls():
    assert _job_url("https://evil.test/jobs") is None
    assert _job_url("https://gupy.io.evil.test/jobs") is None
    assert _job_url("http://gupy.io/jobs") is None
    assert _parse({"id": 5, "name": "Dev", "careerPageName": "ACME",
                   "country": "Argentina", "jobUrl": "https://a.gupy.io/jobs/5"}) is None
