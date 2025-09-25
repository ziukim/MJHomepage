// script.js (주석 버전: 한 줄씩, 매우 자세히)

/*
  이 앱에서 저장하는 데이터 구조(참고):
  {
    id: Number,            // Date.now() 로 만든 고유 숫자 ID
    description: String,   // 내용(예: '점심값')
    amount: Number,        // 금액(양수로만 저장; 부호는 type으로 표현)
    type: "income"|"expense", // 수입/지출
    date: "YYYY-MM-DD"     // 기록 날짜 (오늘)
  }
*/

(() => { // 즉시실행함수(IIFE): 전역변수 오염 방지, 파일 로딩 시 자동실행
  'use strict'; // 엄격 모드: 실수를 줄여줌(암묵적 전역생성 금지 등)

  // ---- [1] 상수(로컬스토리지 키) ----
  const LS_KEY = 'ledger-items:v1';     // 거래 리스트 배열을 저장할 key
  const FILTER_KEY = 'ledger-filter:v1';// 필터 상태(전체/수입/지출)를 저장할 key

  // ---- [2] 앱 상태(전역 변수) ----
  /** items: 모든 거래 내역 배열 (앱의 단일 소스) */
  let items = JSON.parse(localStorage.getItem(LS_KEY)) || []; 
  // ↑ 앱 시작 시 로컬스토리지에서 JSON을 꺼내 JS배열로 파싱. 없으면 빈 배열.

  let currentType = 'income'; // 입력 패널에서 현재 선택된 타입(버튼으로 토글)
  let filterState = localStorage.getItem(FILTER_KEY) || 'all'; 
  // ↑ 마지막 사용 필터를 기억해서 복원. 없으면 'all'

  // ---- [3] DOM 참조 헬퍼 & 주요 요소 캐싱 ----
  const $ = (s) => document.querySelector(s); // 빠른 단일 선택
  const listEl = $('#list');                   // 목록 UL (index.html의 <ul id="list">)

  // 입력 영역 요소들
  const descEl = $('#desc');                   // 내용 입력칸
  const amountEl = $('#amount');               // 금액 입력칸(숫자 입력, 표시만 콤마)
  const btnIncome = $('#btn-income');          // '수입' 버튼
  const btnExpense = $('#btn-expense');        // '지출' 버튼
  const addBtn = $('#add-btn');                // '추가하기' 버튼

  // 헤더/요약 숫자 표시 요소들
  const balanceHeaderEl = $('#balance');       // 헤더에 있는 "현재 잔액"
  const sumIncomeEl = $('#sum-income');        // 요약: 총 수입
  const sumExpenseEl = $('#sum-expense');      // 요약: 총 지출
  const sumBalanceEl = $('#sum-balance');      // 요약: 잔액

  // 필터 버튼들(전체/수입/지출)
  const filterBtns = document.querySelectorAll('.filter-buttons button');

  // ---- [4] 유틸 함수들 ----
  const today = () => new Date().toISOString().slice(0,10);
  // ↑ 오늘 날짜를 'YYYY-MM-DD'로 반환 (입력 시 기본 날짜로 사용)

  const uid = () => Date.now();
  // ↑ 간단한 고유 ID: 밀리초 타임스탬프(충분히 유니크, 과제에는 적합)

  const toCurr = (n) => Number(n).toLocaleString('ko-KR') + '원';
  // ↑ 금액을 '1,234원' 형태로 보기 좋게 표시

  const onlyDigits = (str) => str.replace(/[^\d]/g, '');
  // ↑ 입력 문자열에서 숫자만 남기고 모두 제거(콤마/공백/문자 제거)

  function parseAmount(input){
    // ↑ 표시용으로 '1,234'처럼 입력될 수 있어 숫자만 추출 후 실제 숫자값으로 변환
    const cleaned = onlyDigits(String(input)); // '12a,34' → '1234'
    if (cleaned === '') return NaN;           // 빈 문자열이면 숫자 아님
    return Number(cleaned);                   // 실제 숫자로 변환
  }

  function save(){
    // ↑ 현재 items 배열을 로컬스토리지에 JSON문자열로 저장
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  }

  // ---- [5] 초기화: 이벤트 바인딩 & 첫 렌더 ----
  function init(){
    // (a) 입력 영역: 타입 버튼 토글
    btnIncome.addEventListener('click', () => setType('income')); // 수입 선택
    btnExpense.addEventListener('click', () => setType('expense'));// 지출 선택

    // (b) 금액 입력 칸: 입력할 때마다 보기용 콤마 표시
    amountEl.addEventListener('input', (e)=>{
      const val = onlyDigits(e.target.value);                 // 숫자만 추출
      amountEl.value = val ? Number(val).toLocaleString('ko-KR') : ''; 
      // ↑ 실제 저장은 parseAmount에서 다시 숫자만 쓰고,
      //    여기서는 사용자가 보는 입력창에만 콤마를 찍어줌
    });

    // (c) 추가하기: 클릭/Enter 양쪽 지원
    addBtn.addEventListener('click', addItem);
    descEl.addEventListener('keydown', (e)=> { if (e.key === 'Enter') addItem(); });
    amountEl.addEventListener('keydown', (e)=> { if (e.key === 'Enter') addItem(); });

    // (d) 필터 버튼: 저장된 filterState로 active 표시 복원 + 클릭 시 전환
    filterBtns.forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.filter === filterState);
      // ↑ 지금 필터와 같은 버튼에만 active 클래스 주기(시각상태 동기화)

      btn.addEventListener('click', ()=> setFilter(btn.dataset.filter));
      // ↑ 클릭 시 각 버튼에 있는 data-filter('all'/'income'/'expense')를 읽어 적용
    });

    render(); // 초기 화면 그리기(목록+요약+헤더 잔액)
  }

  // ---- [6] 타입/필터 상태 갱신 ----
  function setType(t){
    // 입력 패널의 '수입/지출' 토글 상태를 바꾸고 버튼 UI(active) 동기화
    currentType = t;
    btnIncome.classList.toggle('active', t==='income');
    btnExpense.classList.toggle('active', t==='expense');
  }

  function setFilter(f){
    // 목록 필터 상태 변경(전체/수입/지출)
    filterState = f;
    localStorage.setItem(FILTER_KEY, f); // 다음 방문 시 복원하려고 저장
    // 버튼들 active 클래스 업데이트(현재 필터만 활성화)
    filterBtns.forEach(b=> b.classList.toggle('active', b.dataset.filter === f));
    render(); // 필터가 바뀌었으니 목록/요약 다시 그림
  }

  // ---- [7] CRUD: 항목 추가/삭제 ----
  function addItem(){
    // (1) 입력값 수집
    const desc = descEl.value.trim();         // 내용 공백제거
    const amt = parseAmount(amountEl.value);  // 표시용 콤마 제거 → 숫자로 변환

    // (2) 입력 검증: 내용 필수, 금액은 양수만 허용
    if (!desc){
      alert('내용을 입력하세요.');
      descEl.focus();
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0){
      alert('금액은 0보다 큰 숫자만 허용됩니다.');
      amountEl.focus();
      return;
    }

    // (3) 아이템 생성: 금액은 '양수'로 저장, 수입/지출은 type으로 구분
    const item = {
      id: uid(),             // 고유ID (Date.now())
      description: desc,     // 내용
      amount: amt,           // 숫자(양수)
      type: currentType,     // 'income' 또는 'expense' (버튼 토글 값)
      date: today(),         // 오늘 날짜
    };

    // (4) 상태 변경 & 저장 & 렌더
    items.push(item); // 배열 끝에 추가
    save();           // 로컬스토리지 반영

    // (5) 입력칸 초기화(사용성)
    descEl.value = '';
    amountEl.value = '';
    descEl.focus();

    // (6) UI 다시 그리기(목록/요약/헤더)
    render();
  }

  function removeItem(id){
    // 주어진 id와 '일치하지 않는 것'만 남긴 새로운 배열로 교체 → 삭제 효과
    items = items.filter(it => it.id !== id);
    save();   // 저장 갱신
    render(); // 다시 그림
  }

  // ---- [8] 목록 데이터(뷰) 추출: 필터 적용 ----
  function getFilteredItems(){
    // 현재 filterState에 따라 목록을 선별해서 반환
    if (filterState === 'all') return items; // 전체
    return items.filter(it => it.type === filterState); // 수입/지출만
  }

  // ---- [9] 렌더링: 목록 + 요약 + 헤더 잔액 ----
  function render(){
    // (A) 목록 영역 비우고 시작
    listEl.innerHTML = '';

    // (B) 필터 적용된 목록 가져오기
    const list = getFilteredItems();

    // (C) 목록이 비었으면 'empty' 메시지 한 줄
    if (list.length === 0){
      const li = document.createElement('li');
      li.className = 'empty';              // CSS로 중앙 정렬/색
      li.textContent = '내역이 없습니다.'; // XSS 방지: textContent 사용
      listEl.appendChild(li);
    } else {
      // (D) 각 항목을 <li>로 만들어 목록에 추가
      for (const it of list){
        const li = document.createElement('li');
        li.className = 'item';             // 한 줄 레이아웃(정보/금액/삭제)

        // ---- (1) 왼쪽: 정보 블록 ----
        const info  = document.createElement('div'); // 정보 래퍼

        const title = document.createElement('div'); // 내용(설명) 텍스트
        title.textContent = it.description;          // 사용자 입력 → textContent로 안전하게

        const meta  = document.createElement('div'); // 날짜 텍스트
        meta.className = 'meta';                     // CSS: 작은 글씨, 회색
        meta.textContent = new Date(it.date)
          .toLocaleDateString('ko-KR', {year:'numeric', month:'long', day:'numeric'});
        // ↑ '2025년 9월 22일' 같은 사람친화적 포맷

        const badge = document.createElement('span'); // 타입 배지(수입/지출)
        badge.className = 'badge ' + (it.type === 'expense' ? 'expense' : 'income');
        // ↑ 'badge expense' 또는 'badge income' → 색상 다름
        badge.textContent = (it.type === 'income' ? '수입' : '지출');

        title.appendChild(badge);   // 내용 옆에 배지 붙이기
        info.appendChild(meta);     // (줄1) 날짜
        info.appendChild(title);    // (줄2) 내용 + 배지

        // ---- (2) 가운데: 금액 ----
        const amt = document.createElement('div');
        amt.className = 'amount ' + (it.type === 'income' ? 'pos' : 'neg');
        // ↑ 수입: 초록(pos), 지출: 빨강(neg)
        const sign = it.type === 'income' ? '+' : '-'; // 표시는 부호로
        amt.textContent = `${sign}${toCurr(it.amount)}`; 
        // ↑ '+1,000원' 또는 '-8,000원' 식으로 표시

        // ---- (3) 오른쪽: 삭제 버튼 ----
        const del = document.createElement('button');
        del.className = 'del';
        del.textContent = '삭제';          // 버튼 라벨
        del.addEventListener('click', ()=> removeItem(it.id)); 
        // ↑ 클릭 시 해당 항목 id로 삭제 로직 호출

        // ---- (4) li 조립 후 목록에 붙이기 ----
        li.appendChild(info);
        li.appendChild(amt);
        li.appendChild(del);
        listEl.appendChild(li);
      }
    }

    // (E) 요약 계산: 총수입/총지출/잔액
    let income = 0, expense = 0;
    for (const it of items){
      if (it.type === 'income') income += it.amount; // 누적
      else expense += it.amount;
    }
    const balance = income - expense; // 잔액

    // (F) 요약 패널 숫자 갱신
    sumIncomeEl.textContent  = toCurr(income);  // '1,000원'
    sumExpenseEl.textContent = toCurr(expense); // '8,000원'
    sumBalanceEl.textContent = toCurr(balance); // '-7,000원' 같은 형식은 아님(부호 없음)

    // (G) 헤더 잔액 및 색상 갱신(양수: 초록, 음수: 빨강)
    balanceHeaderEl.textContent = toCurr(balance);
    balanceHeaderEl.style.color = balance >= 0 ? '#22c55e' : '#ef4444';
  }

  // ---- [10] 엔트리 포인트: DOM이 준비되면 init 실행 ----
  document.addEventListener('DOMContentLoaded', init);
  // ↑ defer로 로드되더라도, DOMContentLoaded 시점이 가장 안전(모든 요소 접근 가능)
})();
