# defaultMD 샘플 문서

**굵게**, *기울임*, ~~취소선~~, `인라인 코드`, <kbd>Ctrl</kbd>+<kbd>O</kbd>

## 목록

- 항목 1입니다.zz
- 항목 2 dfaef
  - 하위 항목

1. 첫째
2. 둘째

- [x] 완료한 일
- [ ] 할 일

> 인용문입니다.
> 여러 줄 인용.

## 표

| 이름 | 수량 | 가격 |
|:-----|:----:|-----:|
| 사과 | 3 | 1,500 |
| 바나나 | 12 | 4,000 |
| 한글이 긴 셀 내용 | 1 | 100 |

## 코드

```typescript
function greet(name: string): string {
  // 인사말
  return `Hello, ${name}!`
}
```

```python
def add(a, b):
    return a + b  # 합
```

## 이미지

상대경로: ![로고](img/logo.png)

## 링크

[외부 링크](https://example.com) · [표로 이동](#표) · 각주[^1]

---

<script>alert('xss')</script>
<img src=x onerror="alert('xss')">

[^1]: 각주 내용입니다.
