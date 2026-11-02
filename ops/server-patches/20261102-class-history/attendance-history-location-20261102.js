// work/attendance-reopen-20261101/history.jsx
import { a as R } from "/assets/react-DFdtPfhg.js";
var h = R.createElement;
function AttendanceHistory({ request, role, classId }) {
  const [checked, setChecked] = R.useState([]), [records, setRecords] = R.useState([]), [selected, setSelected] = R.useState(null), [error, setError] = R.useState(""), [busy, setBusy] = R.useState(false);
  const selectedId = R.useRef(null), alive = R.useRef(true), scope = R.useRef(0);
  R.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function list() {
    const version = scope.current;
    if (role !== "admin" && !classId) {
      setRecords([]);
      return;
    }
    const v = await request("GET", "/core/attendance-records" + (role === "admin" ? "" : "?classId=" + encodeURIComponent(classId)));
    if (alive.current && scope.current === version) setRecords(v);
  }
  R.useEffect(() => {
    let on = true;
    scope.current++;
    selectedId.current = null;
    setSelected(null);
    setChecked([]);
    async function tick() {
      try {
        await list();
      } catch (e) {
        if (on) setError(e.message);
      }
    }
    tick();
    const timer = setInterval(tick, 5e3);
    return () => {
      on = false;
      clearInterval(timer);
    };
  }, [role, classId]);
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function show(id) {
    const version = scope.current;
    const d = await request("GET", "/core/attendance-records/" + encodeURIComponent(id));
    if (version === scope.current) {
      selectedId.current = id;
      setSelected(d);
      setChecked([]);
    }
  }
  async function download(r, cumulative=false) {
    const x = await request("GET", cumulative?"/core/classes/"+encodeURIComponent(r.classId)+"/attendance-excel":"/core/attendance-records/" + encodeURIComponent(r.id) + "/excel");
    const raw = atob(x.base64), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = cumulative ? "班级累计签到.xlsx" : "\u7B7E\u5230\u8BB0\u5F55-" + (r.createdAt || "").slice(0, 10) + ".xlsx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3e4);
  }
  return h("section", { className: "att", style: { marginTop: 24 } }, h("h2", null, "\u7B7E\u5230\u8BB0\u5F55"), h("p", null, role === "admin" ? "\u67E5\u770B\u5404\u73ED\u7B7E\u5230\u8BB0\u5F55\uFF0C\u652F\u6301\u5BFC\u51FA\u548C\u5220\u9664\u3002" : "\u7B7E\u5230\u7ED3\u675F\u540E\u53EF\u67E5\u770B\u8BB0\u5F55\u3001\u4E3A\u672A\u7B7E\u5230\u5B66\u751F\u8865\u7B7E\u6216\u5BFC\u51FA\u3002"), error && h("p", { role: "alert", className: "att-error" }, error), h("button", { onClick: () => act(list), disabled: busy }, "\u5237\u65B0\u8BB0\u5F55"), h("div",{className:"att-toolbar",style:{marginTop:12}},...Array.from(new Map(records.map(r=>[r.classId,r])).values()).map(r=>h("button",{key:r.classId,disabled:busy,onClick:()=>act(()=>download(r,true))},"导出班级累计签到",role==="admin"?" · "+r.className:""))), h("p",{style:{fontSize:14}},"红色：未签到；黄色：位置偏差超过100米，待核对。定位精度不足或无多数中心时单独提示。"), !records.length && h("p", null, "\u6682\u65E0\u7B7E\u5230\u8BB0\u5F55\u3002"), ...records.map((r) => h("article", { key: r.id, style: { border: "1px solid #dce5df", borderRadius: 12, padding: 16, marginTop: 12 } }, h("strong", null, r.title || "\u8BFE\u5802\u7B7E\u5230", role === "admin" ? " \xB7 " + r.className : ""), h("p", null, new Date(r.createdAt).toLocaleString("zh-CN"), " \xB7 ", r.status === "closed" ? "\u5DF2\u7ED3\u675F" : "\u8FDB\u884C\u4E2D\uFF08\u6700\u591A30\u5206\u949F\uFF09", " \xB7 ", r.arrived, " / ", r.total, " \u5DF2\u7B7E\u5230"), h("div", { className: "att-toolbar" }, h("button", { disabled: busy, onClick: () => act(() => show(r.id)) }, "\u67E5\u770B\u540D\u5355"), h("button", { disabled: busy, onClick: () => act(() => download(r)) }, "\u5BFC\u51FA Excel"), role === "teacher" && r.status === "closed" && h("button", { className: "att-primary", disabled: busy, onClick: () => act(async () => {
    await request("POST", "/core/attendance-records/" + r.id + "/reopen", { body: {} });
    setSelected(null);
    setChecked([]);
    await list();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }) }, "\u8865\u7B7E\u5230"), r.status === "closed" && h("button", { disabled: busy, onClick: () => {
    if (confirm("\u786E\u8BA4\u5220\u9664\u8FD9\u6B21\u7B7E\u5230\u8BB0\u5F55\uFF1F")) act(async () => {
      await request("DELETE", "/core/attendance-records/" + r.id);
      if (selectedId.current === r.id) {
        setSelected(null);
        selectedId.current = null;
      }
      await list();
    });
  } }, "\u5220\u9664\u8BB0\u5F55")))), selected && h("div", { style: { marginTop: 20, overflowX: "auto" } }, h("h3", null, selected.title, " \xB7 \u5B66\u751F\u540D\u5355"), h("button", { onClick: () => {
    setSelected(null);
    selectedId.current = null;
    setChecked([]);
  } }, "\u5173\u95ED\u540D\u5355"), role === "teacher" && selected.status === "closed" && selected.students.some((s) => !s.checkedIn) && h("div", { className: "att-toolbar", style: { marginTop: 12 } }, h("button", { disabled: busy, onClick: () => setChecked(selected.students.filter((s) => !s.checkedIn).map((s) => s.studentId)) }, "\u5168\u9009\u672A\u7B7E\u5230"), h("button", { disabled: busy || !checked.length, onClick: () => {
    if (confirm("\u786E\u8BA4\u7ED9\u9009\u4E2D\u7684 " + checked.length + " \u4F4D\u5B66\u751F\u8865\u7B7E\uFF1F")) act(async () => {
      const d = await request("POST", "/core/attendance-records/" + selected.id + "/manual-batch", { body: { studentIds: checked } });
      setSelected(d);
      setChecked([]);
      await list();
    });
  } }, "\u6279\u91CF\u8865\u7B7E\uFF08" + checked.length + "\u4EBA\uFF09")), h("table", { style: { width: "100%", borderCollapse: "collapse", marginTop: 12 } }, h("thead", null, h("tr", null, ...["\u59D3\u540D", "\u5B66\u53F7", "\u72B6\u6001", "\u7B7E\u5230\u65F6\u95F4", "位置（经度, 纬度）", "\u64CD\u4F5C"].map((x) => h("th", { key: x, style: { textAlign: "left", padding: 8 } }, x)))), h("tbody", null, ...selected.students.map((s) => h("tr", { key: s.studentId, style:!s.checkedIn&&selected.status==="closed"?{background:"#ffc7ce",color:"#9c0006"}:s.locationFlag==="outlier"?{background:"#ffeb9c",color:"#7f6000"}:{} }, h("td", { style: { padding: 8 } }, s.studentName), h("td", { style: { padding: 8 } }, s.studentNumber), h("td", { style: { padding: 8 } }, s.checkedIn ? "\u5DF2\u7B7E\u5230" : "\u672A\u7B7E\u5230"), h("td", { style: { padding: 8 } }, s.at ? new Date(s.at).toLocaleString("zh-CN") : "\u2014"), h("td",{style:{padding:8}},s.location?.status==="ok"?s.location.longitude.toFixed(6)+", "+s.location.latitude.toFixed(6):"未获取位置",s.locationFlag==="outlier"?" · 偏差超过100米，待核对":s.locationFlag==="inaccurate"?" · 定位精度不足":s.locationFlag==="insufficient"?" · 有效定位不足或无多数中心":""), h("td", { style: { padding: 8 } }, role === "teacher" && selected.status === "closed" && !s.checkedIn ? h("span", null, h("input", { type: "checkbox", "aria-label": "\u9009\u62E9" + s.studentName, checked: checked.includes(s.studentId), disabled: busy, onChange: (e) => setChecked((old) => e.target.checked ? [...old, s.studentId] : old.filter((id) => id !== s.studentId)) }), h("button", { disabled: busy, onClick: () => act(async () => {
    const d = await request("POST", "/core/attendance-records/" + selected.id + "/manual", { body: { studentId: s.studentId } });
    setSelected(d);
    setChecked((old) => old.filter((id) => id !== s.studentId));
    await list();
  }) }, "\u6807\u8BB0\u5DF2\u7B7E")) : s.checkedIn ? s.method || "\u5DF2\u7B7E\u5230" : "\u2014")))))));
}
export {
  AttendanceHistory
};
