---
layout: post
title: "String vs StringBuffer"
date: 2025-05-16 10:00:00 +0900
categories: [JAVA]
tags: [JAVA]
pin: true
---

## 참고자료

---

[String vs StringBuffer](https://javacan.tistory.com/entry/39)

https://www.digitalocean.com/community/tutorials/string-vs-stringbuffer-vs-stringbuilder

- StringBuild도 나온다.

## 요약

---

| String | StringBuffer |
| --- | --- |
| immutable(변경불가) | mutable(변경가능) |
| 쓰레드나 객체 공유 시 synchronization 장치 없이도 안전하게 공유 가능(애초에 변경 불가이기 때문) | 쓰레드나 객체 공유 시 synchronization가 되어 있어 안전(단, sychronization 때문에 읽기 성능 저하 이슈) |
| 변경할 때 새로운 객체 생성 | 변경할 때 새로운 객체 생성 ❌ |
| 변경 적고, 읽기가 많은 경우 용이 | 변경이 많고, 읽기가 적은 경우 용이 |

### 비교를 위해 테스트에 사용된 8가지 메소드

- String.concat() - String 클래스에 문자열 추가
- StringBuffer.append() - StringBuffer 클래스에 문자열 추가
- Stirng.substring() - String 클래스에서 문자열 일부 추출
- StirngBuffer.substring() - StringBuffer 클래스에서 문자열 일부 추출
- Stirng.toString() - String 클래스의 toString() 메소드 호출 (실제로는 자기자신을 돌린다)
- StirngBuffer.toString() - StringBuffer 클래스의 toString() 메소드 호출 (즉, String 객체로 변환)
- new String() - String 객체 생성
- new StringBuffer() - StringBuffer 객체 생성

![Untitled](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/e78a3db5-053b-437b-a99c-908927b98663/Untitled.png)

***그림 1. 64만번 반복 동안 감소되어가는 자유 메모리의 양 (단위: MB)***

![Untitled](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/dcbf19c8-aeea-4f39-9c44-a529704e2da6/Untitled.png)

***그림 2. 64만번 반복 동안 소요된 시간 (단위: 밀리초)***

<aside>
💡 1. 객체를 생성하지 않는 **String.toString() 메소드**와 **StringBuffer.append() 메소드**는 **메모리 자원을 거의 소모하지 않는다.**
2. **StringBuffer 객체의 생성이 시간과 메모리 자원을 가장 많이 필요**로 한다.
3. StringBuffer의 toString() 메소드 등과 같이 **String 객체를 생성하는 메소드들은 일정한 시간과 일정한 메모리 자원을 소모**한다.

</aside>

### 성능 향상에 대한 결론

- 문자열을 추가하기 위하여 append()와 같은 메소드를 사용할 때 StringBuffer 클래스는 String 클래스와 비교하여 아주 뛰어난 성능을 보인다. **그러나** **StringBuffer 객체의 생성 및 toString() 메소드를 통한 String 객체의 생성을 반드시 필요로 하므로 더 많은 시간 및 메모리 자원의 낭비를 초래**
- String 클래스는 StringBuffer 클래스와 비교하여 **인스턴스화를 통하여 객체를 생성할 때 상대적으로 적은 자원을 소모하며, toString() 메소드를 통하여 String 객체로 바꿀 필요가 없다.**

⇒ StringBuffer 클래스는 하나의 문자열에 대하여 다른 문자나 문자열의 추가가 여러 번 이루어지는 경우 유리하며, **단 한번의 문자열 추가에 대하여 StringBuffer 클래스를 사용하는 것은 오히려 시간 및 메모리 자원 낭비를 초래**하게 된다.

⚠ **64만번**이란 반복 횟수가 많은 것처럼 보일지도 모르지만 실제로 대부분의 웹 사이트와 같은 곳에서 **서블릿/JSP 기술을 사용할 경우 동시 접속자 수에 따른 문자열 처리가 쉽게 수십만번까지 이루어질 수 있다.**
