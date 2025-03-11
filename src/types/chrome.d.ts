declare namespace chrome {
  export namespace tabs {
    export interface Tab {
      id?: number;
      title?: string;
      url?: string;
      windowId?: number;
    }

    export function query(queryInfo: {
      currentWindow?: boolean;
      active?: boolean;
    }): Promise<Tab[]>;

    export function group(options: {
      tabIds: number[];
      createProperties?: {
        windowId?: number;
      };
    }): Promise<number>;
  }

  export namespace runtime {
    export interface Message {
      action: string;
      [key: string]: any;
    }

    export interface MessageSender {
      tab?: tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
    }

    export function sendMessage(
      message: Message,
      responseCallback?: (response: any) => void
    ): void;

    export const onMessage: {
      addListener(
        callback: (
          message: Message,
          sender: MessageSender,
          sendResponse: (response?: any) => void
        ) => void | boolean | Promise<void>
      ): void;
    };
  }

  export namespace notifications {
    export interface NotificationOptions {
      type: 'basic' | 'image' | 'list' | 'progress';
      title: string;
      message: string;
      iconUrl?: string;
      contextMessage?: string;
      priority?: number;
      eventTime?: number;
      buttons?: { title: string; iconUrl?: string }[];
      imageUrl?: string;
      items?: { title: string; message: string }[];
      progress?: number;
    }

    export function create(
      options: NotificationOptions
    ): Promise<string>;
    
    export function create(
      notificationId: string,
      options: NotificationOptions
    ): Promise<string>;
  }

  export namespace tabGroups {
    export type ColorEnum = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan';
    
    export interface TabGroup {
      id: number;
      title?: string;
      color?: ColorEnum;
    }

    export function query(queryInfo: {
      title?: string;
    }): Promise<TabGroup[]>;

    export function update(
      groupId: number,
      updateProperties: {
        title?: string;
        color?: ColorEnum;
      }
    ): Promise<TabGroup>;

    export function create(createProperties: {
      tabIds: number[];
      title?: string;
    }): Promise<TabGroup>;
  }

  export namespace storage {
    export interface StorageArea {
      get(keys: string | string[] | null): Promise<{ [key: string]: any }>;
      set(items: { [key: string]: any }): Promise<void>;
    }

    export const sync: StorageArea;
    export const local: StorageArea;
  }
}
