begin;

drop policy if exists message_conversations_select_participant
  on public.message_conversations;

create policy message_conversations_select_participant
  on public.message_conversations
  for select
  using (
    auth.uid() = created_by
    or public.is_message_conversation_participant(id, auth.uid())
  );

commit;