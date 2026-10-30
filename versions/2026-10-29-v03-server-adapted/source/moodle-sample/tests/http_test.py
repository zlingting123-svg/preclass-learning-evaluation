"""Actual loopback Moodle HTTP checks with independent cookie jars and synthetic accounts."""
from pathlib import Path
from html.parser import HTMLParser
from http.cookiejar import CookieJar
import json, urllib.request, urllib.parse, urllib.error

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8873'
accounts = json.loads((ROOT/'work/private/demo-accounts.json').read_text())
sample = json.loads((ROOT/'work/sample.json').read_text())
results = []

class Inputs(HTMLParser):
    def __init__(self, html):
        super().__init__(); self.hidden = {}; self.feed(html)
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'input' and a.get('type') == 'hidden' and a.get('name'):
            self.hidden[a['name']] = a.get('value', '')

class Client:
    def __init__(self): self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    def request(self, path, fields=None):
        data = None if fields is None else urllib.parse.urlencode(fields, doseq=True).encode()
        req = urllib.request.Request(BASE+path, data=data)
        try: response = self.opener.open(req, timeout=30)
        except urllib.error.HTTPError as e: response = e
        return response.status, dict(response.headers), response.read().decode('utf-8-sig'), response.url
    def login(self, name):
        _,_,body,_=self.request('/login/index.php')
        fields=Inputs(body).hidden
        fields.update(username=accounts[name]['username'],password=accounts[name]['password'])
        self.request('/login/index.php',fields)
        _,_,body,_=self.request('/local/preclass_sample/index.php')
        assert '我的课前任务' in body, 'real Moodle login did not reach task centre'
        return body

def check(name, fn):
    fn(); results.append({'name':name,'result':'pass'}); print('PASS',name,flush=True)
def expect(condition):
    if not condition: raise AssertionError('behavior did not match expected result')
def save(client, course, version, text, extra=()):
    path=f'/local/preclass_sample/profile.php?courseid={course}'
    _,_,body,_=client.request(path)
    fields=[('sesskey',Inputs(body).hidden['sesskey']),('expectedversion',str(version)),('answers[profile-02]',text),*extra]
    return client.request(path,fields)

try:
    anonymous=Client();_,_,loginpage,_=anonymous.request('/login/index.php')
    check('login page uses Learning Platform instead of vendor welcome and global metrics',lambda:expect('学习平台' in loginpage and '欢迎使用Moodle' not in loginpage and '500M' not in loginpage))
    a,b=sample['courses']['A'],sample['courses']['B']
    ta,tb,sa,sb,sa2=Client(),Client(),Client(),Client(),Client()
    ah=ta.login('teacher_a');bh=tb.login('teacher_b');sh=sa.login('001001');sb.login('002001');sa2.login('001002')
    check('real logins and teacher task lists are scoped to own class',lambda:expect('模拟A班' in ah and '模拟B班' not in ah and '模拟B班' in bh and '模拟A班' not in bh))
    check('task centre uses Learning Platform branding and real submitted state',lambda:expect('学习平台' in sh and '进入Moodle课程' not in sh))
    check('one leading-zero student account sees own autumn and cross-term courses',lambda:expect('模拟A班' in sh and '跨期账号复用对照' in sh and '模拟B班' not in sh))
    path=f'/local/preclass_sample/profile.php?courseid={a}'
    _,_,page,_=sa.request(path)
    check('18 questions retained, 11 unconfigured question types visibly withheld',lambda:expect(page.count('<fieldset')==18 and page.count('题型待确认，暂不采集')==11 and '量表只显示1—5' in page))
    version=int(Inputs(page).hidden['expectedversion'])
    status,_,page,_=save(sa,a,version,'模拟A班原始草稿',[('answers[profile-07][r1]','3'),('answers[profile-09][]','c2')])
    check('profile text, matrix and multiselect are persisted after real POST',lambda:expect(status==200 and '画像草稿已保存' in page and '模拟A班原始草稿' in page and int(Inputs(page).hidden['expectedversion'])==version+1))
    status,_,page,_=save(sa,a,version,'模拟冲突输入')
    check('stale draft returns 409 and retains unsaved input without overwriting server',lambda:expect(status==409 and '模拟冲突输入' in page and int(Inputs(page).hidden['expectedversion'])==version))
    _,_,fresh,_=sa.request(path)
    check('reloading confirms earlier database content survived the conflict',lambda:expect('模拟A班原始草稿' in fresh and '模拟冲突输入' not in fresh))
    status,_,page,_=save(sa,a,version+1,'非法选项不会保存',[('answers[profile-09][]','admin')])
    check('unknown choice rejected with 400',lambda:expect(status==400))
    check('valid text survives rejected payload and failed save is explicit',lambda:expect('非法选项不会保存' in page and '本次没有保存' in page))
    fields={'sesskey':'invalid-session-key','expectedversion':version+1,'answers[profile-02]':'CSRF should fail'}
    status,_,page,_=sa.request(path,fields)
    check('invalid CSRF token cannot save answers',lambda:expect('画像草稿已保存' not in page))
    _,_,bpage,_=sb.request(f'/local/preclass_sample/profile.php?courseid={b}')
    save(sb,b,int(Inputs(bpage).hidden['expectedversion']),'模拟B班专属草稿')
    _,_,page,_=sa.request(path+'&userid='+str(sample['students']['002001']))
    check('queried user id cannot read another student draft',lambda:expect('模拟B班专属草稿' not in page and '模拟A班原始草稿' in page))
    _,_,page,_=sa2.request(path+'&userid='+str(sample['students']['001001']))
    check('same-class student cannot read another student draft',lambda:expect('模拟A班原始草稿' not in page))
    report=f'/local/preclass_sample/reports.php?courseid={a}'
    _,_,page,_=ta.request(report)
    check('own-class teacher can view saved profile',lambda:expect('模拟A班原始草稿' in page and '模拟B班专属草稿' not in page))
    _,_,page,_=ta.request(f'/local/preclass_sample/reports.php?courseid={b}')
    check('teacher A cannot read class B profile detail',lambda:expect('模拟B班专属草稿' not in page and '<table class="pcs-table">' not in page))
    _,_,page,_=tb.request(report)
    check('teacher B cannot read class A profile detail',lambda:expect('模拟A班原始草稿' not in page and '<table class="pcs-table">' not in page))
    _,_,page,_=sa.request(report)
    check('student cannot open teacher report',lambda:expect('<table class="pcs-table">' not in page))
    _,_,page,_=ta.request(report)
    # The export link carries a Moodle session key, never saved in the evidence.
    import re,html
    export=html.unescape(re.search(r'href="([^"]*download=1[^"]*)"',page).group(1)).replace(BASE,'')
    status,headers,csv,_=ta.request(export)
    check('authorized CSV contains only own-class draft and preserves leading-zero student number',lambda:expect('text/csv' in headers.get('Content-Type','') and '001001' in csv and '模拟B班专属草稿' not in csv))
    _,headers,csv,_=ta.request(export.replace('courseid='+str(a),'courseid='+str(b)))
    check('changing export course id does not bypass permission',lambda:expect('text/csv' not in headers.get('Content-Type','') and '模拟B班专属草稿' not in csv))
    anon=Client();_,_,page,_=anon.request(report)
    check('anonymous access requires login',lambda:expect('模拟A班原始草稿' not in page and '<table class="pcs-table">' not in page))
    cm=sample['assignments']['A'];bcm=sample['assignments']['B']
    _,_,page,_=sa.request(f'/mod/assign/view.php?id={cm}&action=editsubmission')
    if 'onlinetext_editor[text]' in page:
        fields=Inputs(page).hidden
        fields.update({'onlinetext_editor[text]':'模拟正式文字答卷：仅验证可靠保存，不作为教学参考答案。','onlinetext_editor[format]':'1','submitbutton':'保存更改'})
        status,_,page,_=sa.request(f'/mod/assign/view.php?id={cm}&action=editsubmission',fields)
    else:
        _,_,page,_=sa.request(f'/mod/assign/view.php?id={cm}')
    check('Moodle online-text answer is persisted and readable',lambda:expect('模拟正式文字答卷' in page))
    _,_,page,_=sa.request(f'/mod/assign/view.php?id={cm}&action=submit')
    fields=Inputs(page).hidden
    if any('confirm_submission_form' in name for name in fields):
        fields.update({'submitbutton':'继续'})
        sa.request(f'/mod/assign/view.php?id={cm}&action=submit',fields)
    _,_,page,_=sa.request(f'/mod/assign/view.php?id={cm}')
    check('final submitted answer is readable (database state checked separately)',lambda:expect('模拟正式文字答卷' in page))
    _,_,taskpage,_=sa.request('/local/preclass_sample/index.php')
    check('task centre reflects actual submitted answer',lambda:expect('查看已提交答卷' in taskpage))
    _,_,page,_=tb.request(f'/mod/assign/view.php?id={cm}&action=grading')
    check('other teacher cannot open grading table for foreign course',lambda:expect('模拟正式文字答卷' not in page and 'gradingtable' not in page))
    _,_,page,_=sa.request(f'/mod/assign/view.php?id={bcm}')
    check('student cannot enter other class assignment',lambda:expect('模拟B班专属草稿' not in page and 'action=editsubmission' not in page))
    result={'scope':'actual localhost Moodle HTTP, synthetic accounts; not cloud, load or physical-device acceptance','passed':len(results),'failed':0,'checks':results}
except Exception as error:
    result={'passed':len(results),'failed':1,'checks':results,'error':str(error)}
    raise
finally:
    (ROOT/'verification/http.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
