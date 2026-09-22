import sys
from pathlib import Path
from datetime import date
from unittest.mock import Mock
import pytest
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
import main

@pytest.fixture
def client():
    return TestClient(main.app)

def test_health(client):
    assert client.get('/health').json()['status']=='ok'

def test_auth_missing(client,monkeypatch):
    monkeypatch.setattr(main.s,'supabase_url','https://example.invalid')
    monkeypatch.setattr(main.s,'supabase_anon_key','test')
    assert client.get('/workspace').status_code==401

def test_auth_invalid(client,monkeypatch):
    monkeypatch.setattr(main.s,'supabase_url','https://example.invalid')
    monkeypatch.setattr(main.s,'supabase_anon_key','test')
    monkeypatch.setattr(main.httpx,'get',lambda *a,**k:Mock(status_code=401))
    assert client.get('/notes',headers={'Authorization':'Bearer invalid'}).status_code==401

def test_plan_daily_budget_and_priorities():
    request=main.PlanRequest(subjects=[main.PlanSubject(name='CS',topics=['Easy','Weak'])],weak=['Weak'],minutes_per_day=90,start=date(2026,9,21))
    plan=main.build_plan(request)
    assert len(plan)==21
    assert plan[0]['topic']=='Weak'
    assert len(set(p['id'] for p in plan))==21
    for d in set(p['date'] for p in plan):
        assert sum(p['minutes'] for p in plan if p['date']==d)==90
    assert sum(p['topic']=='Weak' for p in plan)>sum(p['topic']=='Easy' for p in plan)

def test_plan_empty():
    assert main.build_plan(main.PlanRequest(subjects=[],start=date.today()))==[]

def test_ai_quota_blocks_provider(client,monkeypatch):
    user=Mock();user.request.return_value=False
    main.app.dependency_overrides[main.auth]=lambda:user
    monkeypatch.setattr(main.s,'gemini_api_key','test')
    provider=Mock();monkeypatch.setattr(main,'generate',provider)
    try:
        response=client.post('/ai',json={'action':'tutor','prompt':'Help'})
        assert response.status_code==429
        provider.assert_not_called()
    finally: main.app.dependency_overrides.clear()

def test_invalid_assignment_rejected(client):
    user=Mock();main.app.dependency_overrides[main.auth]=lambda:user
    try:
        r=client.put('/workspace',json={'version':0,'data':{'assignments':[{'id':'bad','due':'bad'}]}})
        assert r.status_code==422
        user.request.assert_not_called()
    finally: main.app.dependency_overrides.clear()

def test_upload_non_pdf(client):
    user=Mock();main.app.dependency_overrides[main.auth]=lambda:user
    try:
        r=client.post('/notes',files={'file':('a.pdf',b'not a PDF','application/pdf')})
        assert r.status_code==400
    finally: main.app.dependency_overrides.clear()

def test_quiz_schema_validates_correct_index():
    with pytest.raises(Exception):
        main.Question(question='Q',options=['a','b','c','d'],correct=4,explanation='E',topic='T')
