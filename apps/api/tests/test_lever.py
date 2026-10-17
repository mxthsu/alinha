from alinha_api.agent.lever import _parse, search_lever


def sample():
    return {
        "id":"abc-123",
        "text":"Software Engineer Python",
        "descriptionPlain":"Python systems. FastAPI, Postgres.",
        "country":"BR",
        "categories":{"location":"Remote / Brazil", "commitment":"Full-time"},
        "workplaceType":"remote",
        "hostedUrl":"https://jobs.lever.co/Flex/abc-123",
    }

def test_lever_accepts_brazil_and_rejects_foreign_jobs():
    found = _parse(sample(), "Flex", "Python", True)
    assert found is not None
    assert found.opportunity.work_mode == "remote"
    assert found.opportunity.source == "lever"
    assert _parse({**sample(),"country":"US","categories":{"location":"Remote / US"}},
                  "Flex", "Python", False) is None
    assert _parse({**sample(),"hostedUrl":"https://evil.test/jobs"}, "Flex", "Python", False) is None

def test_lever_filters_relevance_and_mode():
    assert _parse(sample(),"Flex","Rust",False) is None
    assert _parse({**sample(),"workplaceType":"hybrid"},"Flex","Python",True) is None

def test_lever_endpoint_returns_tested_job(monkeypatch):
    import httpx

    from alinha_api.agent import lever
    original = httpx.Client
    def fake_client(**kwargs):
        def reply(request):
            assert request.url.host == "api.lever.co"
            assert request.url.path == "/v0/postings/Flex"
            return httpx.Response(200, json=[sample()])
        return original(transport=httpx.MockTransport(reply), **kwargs)
    monkeypatch.setattr(lever.httpx, "Client", fake_client)
    found=search_lever("Python", remote_only=True)
    assert len(found.jobs)==1
