import { REQUEST_TIMEOUT_MS } from "@/app/constant";
import { useAccessStore, useAppConfig, useChatStore } from "@/app/store";

import { ChatOptions, getHeaders, LLMApi, LLMUsage } from "../api";
import Locale from "../../locales";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@fortaine/fetch-event-source";
import { prettyObject } from "@/app/utils/format";
import { sendMessage } from "next/dist/client/dev/error-overlay/websocket";
import ResponseController from "@/app/api/controller/ResponseController";
export class ChatGPTApi implements LLMApi {
  public ChatPath =
    "/openai/deployments/chatGPT/chat/completions\\?api-version\\=2023-05-15";
  public UsagePath = "dashboard/billing/usage";
  public SubsPath = "dashboard/billing/subscription";

  getHistory(messages: any[]): any[] {
    const history: any[] = [];
    let systemContent: any = null;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const { role, content } = message;
      history.push([role, content]);
      // if (role === "system") {
      //   if (systemContent !== null) {
      //     history.push(["system", systemContent]);
      //     systemContent = null;
      //   }
      // } else if (role === "user") {
      //   const nextMessage = messages[i + 1];
      //   if (nextMessage && nextMessage.role === "user") {
      //     history.push([content, nextMessage.content]);
      //     i++; // 跳过下一个消息，因为已经处理了
      //   } else {
      //     history.push([content, ""]);
      //   }
      // } else {
      //   // 其他角色的消息处理逻辑
      //   // 如果有需要，请根据需求进行修改或添加
      // }
    }

    return history;
  }

  path(path: string): string {
    let openaiUrl = useAccessStore.getState().openaiUrl;
    if (openaiUrl.endsWith("/")) {
      openaiUrl = openaiUrl.slice(0, openaiUrl.length - 1);
    }
    return [openaiUrl, path].join("/");
  }

  extractMessage(res: any) {
    return res.choices?.at(0)?.message?.content ?? "";
    //  const text = res.text ?? ""; // 获取res对象中的text字段值，如果不存在则使用空字符串作为默认值
    //  return text;
  }

  async chat(options: ChatOptions) {
    const messages = options.messages.map((v) => ({
      role: v.role,
      content: v.content,
      message_id: v.message_id,
    }));

    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
      },
    };
    const messages2 = options.messages.map((v) => ({
      role: v.role,
      content: v.content,
      // message_id: v.message_id,
    }));

    const requestPayload = {
      messages: messages2,
      stream: options.config.stream,
      model: modelConfig.model,
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.max_tokens,
      presence_penalty: modelConfig.presence_penalty,
    };

    const shouldStream = !!options.config.stream;
    const controller = new AbortController();
    options.onController?.(controller);

    try {
      //alert("gpt!")
      //alert("options.config.stream"+ options.config.stream +"  "+shouldStream)
      const chatPath = this.path(this.ChatPath);
      const chatPayload = {
        method: "POST",
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
        headers: getHeaders(),
      };
      // make a fetch request
      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );
      const question = messages[messages.length - 1].content;
      if (shouldStream) {
        let responseText = "";
        let finished = false;

        const ques = {
          agent_name: options.agent_name,
          name: options.name,
          question: question,
          group: options.group,
          uuid: options.uuid,
          messages,
          stream: options.config.stream,
          model: modelConfig.model,
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.max_tokens,
          presence_penalty: modelConfig.presence_penalty,
        };
        const quesPayload = {
          method: "POST",
          body: JSON.stringify(ques),
          signal: controller.signal,
          headers: getHeaders(),
        };

        const res = await fetch(
          "http://18.116.115.123:5000/api/v1/" + "storequestion",
          quesPayload,
        );
        const m_id = await res.json();

        console.log("The res is ", m_id.content);
        const finish = async () => {
          const testBody = {
            uuid: options.uuid,
            request_id: m_id,
            agent_name: options.agent_name,
            name: options.name,
            group: options.group,
            response: responseText,
          };
          const testPayload = {
            method: "POST",
            body: JSON.stringify(testBody),
            signal: controller.signal,
            headers: getHeaders(),
          };
          const res = await fetch(
            "http://18.116.115.123:5000/api/v1/" + "storeresponse",
            testPayload,
          );
          const re_id = await res.json();

          if (!finished) {
            // alert(re_id.content)
            const message_id = re_id.content;
            //alert(typeof message_id)
            options.onFinish(responseText, undefined, message_id);
            finished = true;
          }

          console.log("The res id is ", re_id.content);
          //alert(responseText);
        };

        controller.signal.onabort = finish;

        fetchEventSource(chatPath, {
          ...chatPayload,
          async onopen(res) {
            clearTimeout(requestTimeoutId);
            const contentType = res.headers.get("content-type");
            if (contentType?.startsWith("text/plain")) {
              responseText = await res.clone().text();
              return finish();
            }

            if (
              !res.ok ||
              !res.headers
                .get("content-type")
                ?.startsWith(EventStreamContentType) ||
              res.status !== 200
            ) {
              //alert("The here");

              const responseTexts = [responseText];
              let extraInfo = await res.clone().text();
              try {
                const resJson = await res.clone().json();
                extraInfo = prettyObject(resJson);
              } catch {}

              if (res.status === 401) {
                responseTexts.push(Locale.Error.Unauthorized);
              }

              if (extraInfo) {
                responseTexts.push(extraInfo);
              }

              responseText = responseTexts.join("\n\n");

              return finish();
            }
          },
          onmessage(msg) {
            if (msg.data === "[DONE]" || finished) {
              return finish();
            }
            const text = msg.data;
            try {
              const json = JSON.parse(text);
              const delta = json.choices[0].delta.content;
              //const delta = json.text;

              if (delta) {
                responseText += delta;
                options.onUpdate?.(responseText, delta);
              }
            } catch (e) {
              console.error("[Request] parse error", text, msg);
            }
          },
          onclose() {
            finish();
          },
          onerror(e) {
            options.onError?.(e);
            throw e;
          },
          openWhenHidden: true,
        });
      } else {
        //alert(modelConfig.model)
        if (modelConfig.model === "gpt-3.5-turbo(Free talk)") {
          try {
            const startTime = new Date();

            let responseText = "";
            let finished = false;

            const finishno = async () => {
              // const testBody = {
              //   agent_name: options.agent_name,
              //   name: options.name,
              //   group: options.group,
              //   request_id: "error",
              //   uuid: options.uuid,
              //   response: responseText,
              // };
              // const testPayload = {
              //   method: "POST",
              //   body: JSON.stringify(testBody),
              //   signal: controller.signal,
              //   headers: getHeaders(),
              // };
              const testBody = {
                uuid: options.uuid,
                request_id: m_id,
                agent_name: options.agent_name,
                name: options.name,
                group: options.group,
                response: responseText,
              };
              const testPayload = {
                method: "POST",
                body: JSON.stringify(testBody),
                signal: controller.signal,
                headers: getHeaders(),
              };
              const res = await fetch(
                "http://18.116.115.123:5000/api/v1/" + "storeresponse",
                testPayload,
              );
              console.log(res);

              //alert(responseText);
            };

            const testBody = {
              uuid: options.uuid,
              response: responseText,
            };

            const testPayload = {
              method: "POST",
              body: JSON.stringify(testBody),
              signal: controller.signal,
              headers: getHeaders(),
            };
            //alert("ooo")
            const ques = {
              agent_name: options.agent_name,
              name: options.name,
              group: options.group,
              uuid: options.uuid,
              question: question,
              messages,
              stream: options.config.stream,
              model: modelConfig.model,
              temperature: modelConfig.temperature,
              max_tokens: modelConfig.max_tokens,
              presence_penalty: modelConfig.presence_penalty,
            };
            const quesPayload = {
              method: "POST",
              body: JSON.stringify(ques),
              signal: controller.signal,
              headers: getHeaders(),
            };

            const resw = await fetch(
              "http://18.116.115.123:5000/api/v1/" + "storequestion",
              quesPayload,
            );
            //alert(responseText);
            const m_id = await resw.json();
            const res = await fetch(chatPath, chatPayload);

            const endTime = new Date();
            const executionTime = endTime.getTime() - startTime.getTime();
            //alert(executionTime);
            //const res = await fetch(testPath, testPayload);
            clearTimeout(requestTimeoutId);

            if (!res.ok) {
              throw new Error(`HTTP error! Status: ${res.status}`);
            }
            const resJson = await res.json();
            const message = this.extractMessage(resJson);
            //const message = resJson.text;
            //alert(message)
            responseText = message;
            const message_id = resJson.response_id;
            finishno();
            options.onFinish(message, message_id);
          } catch (error) {
            console.error("Request error:", error);
          }
        } else {
          //alert("poil")
          const history = this.getHistory(messages);
          const uuid = options.uuid;
          //const testPath = "http://localhost:3001/api/chat/";
          console.log("final message ", messages);
          console.log("final history", history);
          const is_agents =
            modelConfig.model !== "lang chain(Upload your docs)";
          const testBody = {
            is_agents: is_agents,
            uuid: uuid,
            question: question,
            agent_name: options.agent_name,
            name: options.name,
            group: options.group,
            history: history,
            agent_prompt: options.prompt,
            max_tokens: modelConfig.max_tokens,
            presence_penalty: modelConfig.presence_penalty,
          };
          console.log("The question here is", testBody);
          console.log(testBody);
          const testPayload = {
            method: "POST",
            body: JSON.stringify(testBody),
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
            },
          };
          //salert("There!")
          try {
            //alert("langchain")
            //alert("kkkk")
            //const res = await fetch(testPath, testPayload);

            const res = await fetch(
              "http://18.116.115.123:5000/api/v1/" + "getresponse",
              testPayload,
            );
            clearTimeout(requestTimeoutId);

            if (!res.ok) {
              throw new Error(`HTTP error! Status: ${res.status}`);
            }
            const resJson = await res.json();
            const message = resJson.text;
            const sourceDocs = resJson.sourceDocuments;
            const message_id = resJson.response_id;
            // messages[messages.length - 1].message_id;
            //console.log("The res id is ",resJson.response_id)
            console.log("The Docs is ", sourceDocs);
            //alert(message)
            options.onFinish(message, sourceDocs, message_id);
          } catch (error) {
            console.error("Request error:", error);
          }
        }
      }
    } catch (e) {
      console.log("[Request] failed to make a chat reqeust", e);
      options.onError?.(e as Error);
    }
  }

  async usage() {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
        .getDate()
        .toString()
        .padStart(2, "0")}`;
    const ONE_DAY = 1 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = formatDate(startOfMonth);
    const endDate = formatDate(new Date(Date.now() + ONE_DAY));

    const [used, subs] = await Promise.all([
      fetch(
        this.path(
          `${this.UsagePath}?start_date=${startDate}&end_date=${endDate}`,
        ),
        {
          method: "GET",
          headers: getHeaders(),
        },
      ),
      fetch(this.path(this.SubsPath), {
        method: "GET",
        headers: getHeaders(),
      }),
    ]);

    if (used.status === 401) {
      throw new Error(Locale.Error.Unauthorized);
    }

    if (!used.ok || !subs.ok) {
      throw new Error("Failed to query usage from openai");
    }

    const response = (await used.json()) as {
      total_usage?: number;
      error?: {
        type: string;
        message: string;
      };
    };

    const total = (await subs.json()) as {
      hard_limit_usd?: number;
    };

    if (response.error && response.error.type) {
      throw Error(response.error.message);
    }

    if (response.total_usage) {
      response.total_usage = Math.round(response.total_usage) / 100;
    }

    if (total.hard_limit_usd) {
      total.hard_limit_usd = Math.round(total.hard_limit_usd * 100) / 100;
    }

    return {
      used: response.total_usage,
      total: total.hard_limit_usd,
    } as LLMUsage;
  }
}
