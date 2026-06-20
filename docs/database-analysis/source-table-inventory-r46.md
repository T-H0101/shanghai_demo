Already up to date
Done in 193ms using pnpm v11.3.0
Already up to date
Done in 202ms using pnpm v11.3.0
# Source Table Inventory (R.46)

> Generated: 2026-06-20T09:19:55.578Z
> Database: SITE_DATABASE_URL (star_storage_db, port 5434)
> table_count: 170

| # | table | rows | matched_keywords | key_columns |
|---:|---|---:|---|---|
| 1 | tbl_api_interface | 0 |  | id, api_name, api_type, api_path, create_time, update_time |
| 2 | tbl_api_log | 0 | file, log, user | id, file_name, call_type, caller_name, method_name, caller_user_name, call_start_time, call_end_time, call_result |
| 3 | tbl_archives_level | 0 |  | id, name, type_id, level_type |
| 4 | tbl_archives_type | 0 |  | id, type_name |
| 5 | tbl_back_window | 0 |  | id, start_time, end_time |
| 6 | tbl_backup_db | 18 | task | id, backup_path, status, task_id |
| 7 | tbl_buffer_dir | 0 | task, user | id, name, user_id, src_path, min_size |
| 8 | tbl_cd_cabinet | 0 |  | cd_id, disk_uuid |
| 9 | tbl_check_category | 0 |  | id, category_name, create_time, update_time, del_status |
| 10 | tbl_check_file | 0 | file, folder, task, volume, hash | id, folder_id, file_name, file_size, hash, task_id, volume_id |
| 11 | tbl_check_files | 0 | file | id, file_name, file_path, create_time, update_time |
| 12 | tbl_check_item | 0 | file | id, template_id, check_type, item_name, create_time, update_time, del_status |
| 13 | tbl_check_log | 0 | file, task, log | id, task_id, task_item_id, check_item_id, info_type, create_time |
| 14 | tbl_check_patrol_log | 0 | file, task, log, patrol | id, task_id, strategy_id, task_item_id, info_type, create_time |
| 15 | tbl_check_patrol_strategy | 0 | user, patrol | id, strategy_name, template_id, effective_date, terminated_date, create_time, update_time, del_status, user_id |
| 16 | tbl_check_patrol_task | 0 | task, patrol | id, strategy_id, template_id, name, status, create_time, update_time, start_time, finished_time, medium_task_id, del_status |
| 17 | tbl_check_patrol_task_item | 0 | file, task, hash, patrol | id, task_id, strategy_id, file_id, check_task_id, package_name, package_path, package_hash, package_size, template_id, status, create_time, update_time, start_time, finished_time |
| 18 | tbl_check_sector | 0 |  | id, sector_name, create_time, update_time, del_status |
| 19 | tbl_check_sub_category | 0 |  | id, template_id, create_time, update_time, del_status |
| 20 | tbl_check_task | 0 | file, task | id, template_id, before_file_id, after_file_id, status, commit_time, finish_time, create_time, update_time, del_status |
| 21 | tbl_check_task_file | 0 | file, task | task_id, task_item_id, check_item_id, file_id, create_time, update_time |
| 22 | tbl_check_task_item | 0 | file, task | id, task_id, check_item_id, file_id, status, commit_time, finish_time, create_time, update_time, del_status |
| 23 | tbl_check_template | 0 | file | id, template_type, template_name, create_time, update_time, del_status |
| 24 | tbl_credible_prove | 0 | file, task, user, volume, hash | id, user_id, task_id, task_item_id, zip_file_id, volume_id, optical_path, file_name, file_size, hash, verify_hash, create_date, certify_date, verify_date, prove_uuid |
| 25 | tbl_credible_verify | 0 | file, user, hash | id, user_id, credible_prove_id, zip_file_id, file_name, prove_hash, verify_hash, create_date, certify_date, verify_date, verify_uuid, verify_status, report_verify_hash, report_date, report_path |
| 26 | tbl_csv_details | 0 | file, hash | id, file_name, file_size, file_path, file_hash, zip_file_id, manage_id, package_file_hash, chain_id, prove_file_path, verify_result, system_type, type, tx_hash, cert_hash |
| 27 | tbl_data_classification | 125 |  | id, data_name, data_type |
| 28 | tbl_data_receive_list | 0 | file, volume | id, transfer_date, receive_date, files_size, update_dt, status, volume_id, data_class_id, local_path |
| 29 | tbl_data_receive_log | 0 | log, user | id, operate_type, create_date, user_id, result |
| 30 | tbl_data_receive_tasks | 0 | task | id, task_id, receive_id |
| 31 | tbl_depa | 0 | depa | depa_id, depa_name, alia_name, create_time, update_time |
| 32 | tbl_depa_user | 0 | user, depa | depa_id, user_id |
| 33 | tbl_depa_user_info | 0 | user, depa | id, depa_id, user_id, fuc_id, create_time, update_time, del_status |
| 34 | tbl_device_device | 0 | device | id |
| 35 | tbl_dict | 0 |  | id, category_id, dict_name, show_status, create_time, update_time |
| 36 | tbl_dict_category | 0 |  | id, category_name, show_status, create_time, update_time |
| 37 | tbl_dict_item | 0 |  | id, dict_id, item_name, show_status, create_time, update_time |
| 38 | tbl_disc | 65 | file, task, error, disc, slot, device, burn | id, task_id, slot_id, used_size, extra_size, burn_errors, error_files, iso_status, iso_path, update_dt |
| 39 | tbl_disc_inspect | 0 | error, disc | id, check_id, disc_type, disc_mid, disc_vid, inspect_type, inspect_start_time, inspect_stop_time, error, result_evaluation, csv_path |
| 40 | tbl_disc_lib | 4 | user, disc, slot, mag, device | lib_id, group_id, device_status, name, type, disc_type, use_status, lib_user |
| 41 | tbl_disc_print | 0 | disc | id, disc_id, dat_path, uuid |
| 42 | tbl_disc_type | 10 | disc | id |
| 43 | tbl_disk_check | 0 | task, volume | id, task_id, volume_id |
| 44 | tbl_diskfile_check | 0 | file, task, volume | id, task_id, volume_id, file_path |
| 45 | tbl_download_details | 0 |  | wait_download_id, csv_details_id |
| 46 | tbl_download_record | 0 | file, user, depa | id, wait_download_id, file_name, file_size, file_path, operate_time, user_id, data_type, org_depa_id, system_type |
| 47 | tbl_drivers | 4 | error, disc | driver_id, lib_id, start_time, write_time, read_time, error_times, virtual_path, drive_status, buffer_path, disc_status, warn_time, swarn_time |
| 48 | tbl_drivers_burn | 2 | burn | id, burn_status, start_time, end_time |
| 49 | tbl_early_warning | 0 |  | id, type, status, create_date |
| 50 | tbl_early_warning_feedback | 0 | user | id, user_name, create_date, early_warning_id |
| 51 | tbl_error_rate | 0 | error, disc, slot | id, check_id, slot_id, result, date |
| 52 | tbl_escape | 0 |  | id |
| 53 | tbl_evidence_details | 0 | file, hash | id, uuid, record_id, file_name, file_size, file_path, file_hash, zip_file_id, manage_id, package_file_hash, prove_file_path, system_type, status, chain_status, chain_id |
| 54 | tbl_evidence_record_drp | 0 | file, user, depa | id, upload_record_id, file_name, operate_time, user_id, org_depa_id, status |
| 55 | tbl_export_info | 0 | file, user, hash | id, zip_file_id, from_path, to_path, update_dt, media_type, name, file_size, hash, status, user_id |
| 56 | tbl_file | 4 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 57 | tbl_file_1 | 1773 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 58 | tbl_file_10000 | 41 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 59 | tbl_file_10001 | 42 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 60 | tbl_file_10002 | 42 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 61 | tbl_file_1_a | 1772 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 62 | tbl_file_1_empty | 0 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 63 | tbl_file_1_error | 0 | file, folder, task, error, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 64 | tbl_file_1_repeat | 0 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 65 | tbl_file_2 | 40421 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 66 | tbl_file_2_a | 22455 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 67 | tbl_file_2_empty | 0 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 68 | tbl_file_2_error | 0 | file, folder, task, error, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 69 | tbl_file_2_repeat | 0 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 70 | tbl_file_3 | 11703 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 71 | tbl_file_3_a | 27658 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 72 | tbl_file_3_empty | 0 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 73 | tbl_file_3_error | 0 | file, folder, task, error, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 74 | tbl_file_3_repeat | 0 | file, folder, task, disc, slot, hash, burn | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, hash1, task_id, items_id, create_date, status, burn_times, slot_id, content_type |
| 75 | tbl_file_parts | 0 | file, volume | id, volume_id, file_id, split_file_id, status |
| 76 | tbl_file_path_archive | 0 | file, folder, slot, volume | id, job_id, app_uuid, cache_path, cache_path_escaped, lib_path, volume_id, file_id, folder_id, file_size, check_status, type, slot_id |
| 77 | tbl_file_path_restore | 0 | file, folder, slot, volume, restore | id, job_id, app_uuid, cache_path, cache_path_escaped, volume_id, file_id, folder_id, file_size, check_status, type, slot_id |
| 78 | tbl_file_recover_info | 0 | file, folder, task, volume, hash | id, pre_file_id, pre_folder_id, pre_volume_id, task_id, name, file_size, hash |
| 79 | tbl_file_stat | 0 | file, task, volume | id, volume_id, task_id, files_type, files_size |
| 80 | tbl_film_operat | 0 |  | id, lib_id, uuid, name, type, time |
| 81 | tbl_folder | 0 | file, folder, disc | id, name, folder_path, disc_path |
| 82 | tbl_folder_1 | 184 | file, folder, disc | id, name, folder_path, disc_path |
| 83 | tbl_folder_10000 | 2 | file, folder, disc | id, name, folder_path, disc_path |
| 84 | tbl_folder_2 | 5199 | file, folder, disc | id, name, folder_path, disc_path |
| 85 | tbl_folder_3 | 2871 | file, folder, disc | id, name, folder_path, disc_path |
| 86 | tbl_ft_file | 0 | file, task, slot, volume, burn, restore | id, task_id, slot_id, volume_id, file_id, items_id, size, status, storage_status, restored_name |
| 87 | tbl_ft_sys | 23 |  | item_name |
| 88 | tbl_fuc | 53 |  | fun_id, fun_name, parent_id, type |
| 89 | tbl_hd_info | 8 | file, slot | slot_id, name, file_path, hd_status, raid_type, raid_vid |
| 90 | tbl_hd_manager | 74 |  | id |
| 91 | tbl_hd_power | 0 | task, slot, mag | id, task_id, lib_id, mag_id, status |
| 92 | tbl_hot_backup_record | 0 | error | id, schedule_job_id, from_path, to_path, status, start_time, end_time, error_message |
| 93 | tbl_hot_restore_record | 0 | error, restore | id, schedule_job_id, from_path, to_path, status, start_time, end_time, error_message |
| 94 | tbl_import_folder_data | 0 | folder, log | id, log_id |
| 95 | tbl_import_folder_log | 0 | file, folder, log | id, type, file_name, create_time, status |
| 96 | tbl_import_folder_title | 0 | file, folder | id, type |
| 97 | tbl_interface_task | 0 | task, volume | id, create_time, batch_id, task_id, volume_id, job_type, job_status, buffer_id, json_path, json_type |
| 98 | tbl_iso_location | 0 | task, slot, mag, volume, hash | id, iso_id, iso_name, hash, create_time, lib_id, mag_id, slot_id, volume_id, task_id, backup_path, status, backup_type |
| 99 | tbl_iso_task_sync | 0 | task, volume | id, task_id, type, volume_id, status, create_time |
| 100 | tbl_lib_group | 0 |  | id, group_name |
| 101 | tbl_lib_task | 86 | task, disc | id, task_id, disc_id, task_status, lib_id |
| 102 | tbl_logical_volume | 3 | file, log, user, volume | volume_id, group_id, type, uuid, name, max_file_id, create_time, update_time, create_user, update_user, mount_id |
| 103 | tbl_magzines | 6 | disc, mag | mag_id, lib_id, rfid, disc_type, door_status, earliest_time, latest_time |
| 104 | tbl_meta_data | 0 |  | id, type, rfid |
| 105 | tbl_monitor_path | 1 | file | id, file_path, last_table_id, last_time, total_size |
| 106 | tbl_mount_dir | 0 | user | id, src_path, manager_path, user_name, mount_date |
| 107 | tbl_platform | 0 | user | plat_id, type_id, plat_name, user_name |
| 108 | tbl_platform_monitor | 0 |  | monitor_id, monitor_name, uuid, plat_id |
| 109 | tbl_platform_type | 7 |  | type_id, type_name |
| 110 | tbl_project | 0 | volume | project_id, volume_id, status |
| 111 | tbl_project_monitor_files | 0 | file, task | id, task_id, project_id, monitor_id, file_name, file_size, archive_path, start_time, end_time, status, retry_times |
| 112 | tbl_project_site | 0 |  | id, project_id, site_id, start_time, end_time |
| 113 | tbl_raid_group | 0 | volume | group_id, parity_path, volume_id |
| 114 | tbl_receipt | 0 | file, task, volume | id, transfer_date, status, update_dt, volume_id, file_path, ws_id, type, archive_type, template_type, check_type, scan_task_id |
| 115 | tbl_receipt_check | 0 | file | r_file_id, check_id, result |
| 116 | tbl_receipt_file | 0 | file, hash | id, file_name, file_size, hash, r_id, create_date, status, path, check_id |
| 117 | tbl_receipt_file_detail | 0 | file, folder, hash | id, receipt_file_id, file_name, path, file_size, hash, create_date, status |
| 118 | tbl_register_management | 0 | slot | id, create_date, update_date, slot_type, slot_status |
| 119 | tbl_remote_backup | 0 |  | id, name, aws_access_key_id |
| 120 | tbl_role | 4 | role | role_id, role_name, role_type |
| 121 | tbl_role_fuc | 58 | role | role_id, fun_id |
| 122 | tbl_schedule_job | 0 | task | id, task_name, func_name, create_time, update_time |
| 123 | tbl_site | 0 |  | site_id, uuid, site_name |
| 124 | tbl_site_monitor | 0 |  | monitor_id, monitor_name, old_name, uuid, site_id, plat_id |
| 125 | tbl_slot_file_1000000 | 1772 | file, folder, task, disc, slot, hash | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, task_id, items_id, create_date, status, slot_id, content_type |
| 126 | tbl_slot_file_12 | 7876 | file, folder, task, disc, slot, hash | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, task_id, items_id, create_date, status, slot_id, content_type |
| 127 | tbl_slot_file_13 | 14518 | file, folder, task, disc, slot, hash | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, task_id, items_id, create_date, status, slot_id, content_type |
| 128 | tbl_slot_file_15 | 61 | file, folder, task, disc, slot, hash | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, task_id, items_id, create_date, status, slot_id, content_type |
| 129 | tbl_slot_file_30 | 21083 | file, folder, task, disc, slot, hash | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, task_id, items_id, create_date, status, slot_id, content_type |
| 130 | tbl_slot_file_31 | 6575 | file, folder, task, disc, slot, hash | id, uuid, folder_id, file_name, file_disc_name, file_size, hash, task_id, items_id, create_date, status, slot_id, content_type |
| 131 | tbl_slot_folder_1000000 | 181 | file, folder, disc, slot | id, name, folder_path, disc_path, slot_id |
| 132 | tbl_slot_folder_12 | 1033 | file, folder, disc, slot | id, name, folder_path, disc_path, slot_id |
| 133 | tbl_slot_folder_13 | 1149 | file, folder, disc, slot | id, name, folder_path, disc_path, slot_id |
| 134 | tbl_slot_folder_15 | 8 | file, folder, disc, slot | id, name, folder_path, disc_path, slot_id |
| 135 | tbl_slot_folder_30 | 1617 | file, folder, disc, slot | id, name, folder_path, disc_path, slot_id |
| 136 | tbl_slot_folder_31 | 501 | file, folder, disc, slot | id, name, folder_path, disc_path, slot_id |
| 137 | tbl_slots | 396 | disc, slot, mag | slot_id, mag_id, disc_type, hd_type, group_id |
| 138 | tbl_slots_part | 1 | file, slot | part_id, part_name |
| 139 | tbl_sys | 0 | log | id, name, type, db_back_time, en_name, menu_type |
| 140 | tbl_sys_env | 0 |  | id, lib_id |
| 141 | tbl_sys_log | 85 | file, task, log, user, depa | id, type, operate_type, create_date, user_id, u_id, depa_id, ws_id, r_id, result, lib_id, task_id, zip_file_id |
| 142 | tbl_task | 37 | file, task, disc, slot, hash, burn | id, uuid, task_type, update_dt, status, burn_status, task_name, json_path, slot_type, save_hash, total_size |
| 143 | tbl_task_certif_status | 0 | task | id, task_id, task_item_id, task_type, status, create_time, update_time |
| 144 | tbl_task_check | 0 | task, disc, slot | id, lib_id, date, status |
| 145 | tbl_task_files | 0 | file, task | id, file_path, file_size, close_time, monitor_id |
| 146 | tbl_task_folder | 22 | folder, task, volume | task_id, volume_id, min_folder_id, max_folder_id |
| 147 | tbl_task_items | 47 | folder, task, slot, volume | id, task_id, root_path, original_path, item_name, volume_id, slot_id, status, project_id |
| 148 | tbl_task_print | 0 | task, disc | id, task_id, print_date, publisher_type, json_path |
| 149 | tbl_task_projects | 0 | task | id, task_id, project_id |
| 150 | tbl_task_receipts | 0 | task | id, task_id, r_id |
| 151 | tbl_temp_slots | 44 | task, disc, slot | task_id, slot_id, disc_type |
| 152 | tbl_upload_details | 0 |  | upload_id, csv_details_id |
| 153 | tbl_upload_record | 0 | file, user, depa | id, file_name, file_size, operate_time, user_id, data_type, org_depa_id, system_type |
| 154 | tbl_user | 3 | log, error, user, role, depa | user_id, role_id, uuid, name, display_name, login_status, user_type, create_time, update_time, expiration_time, create_user, update_user, share_type, face_path, face_id |
| 155 | tbl_user_mfa | 0 | user | id, user_id, mfa_type, display_name |
| 156 | tbl_user_role | 0 | user, role | user_id, role_id |
| 157 | tbl_user_task | 28 | task, user | user_id, task_id, machine_uuid, os_hostname, user_name, user_agent, customer_builddate, user_stage_acting, user_stage_failedcount, user_stage_faileddate, username, useragent, customerbuilddate, userstageacting, userstagefailedcount |
| 158 | tbl_verify_details | 0 | file, hash | id, record_id, file_name, file_size, file_path, file_hash, zip_file_id, manage_id, package_file_hash, chain_id, verify_result, system_type |
| 159 | tbl_verify_record_drp | 0 | file, task, user, depa | id, upload_record_id, file_name, operate_time, user_id, org_depa_id, status, task_no |
| 160 | tbl_volume_dataclass | 0 | volume | volume_id, data_class_id |
| 161 | tbl_volume_depa | 0 | depa, volume | volume_id, depa_id |
| 162 | tbl_volume_group | 0 | volume | group_id, name |
| 163 | tbl_volume_slot | 161 | slot, volume | volume_id, slot_id |
| 164 | tbl_volume_user | 3 | user, volume | volume_id, user_id |
| 165 | tbl_volume_workspace | 0 | depa, volume | volume_id, depa_id, ws_id |
| 166 | tbl_wait_download_file | 0 | file, user, depa | id, file_name, file_size, file_path, create_time, user_id, data_type, org_depa_id, system_type, file_status |
| 167 | tbl_wait_download_file_task | 0 | file, task | wait_download_id, task_id |
| 168 | tbl_workspace | 0 | user, depa | ws_id, depa_id, user_id, ws_name, alia_name, ws_type, model_id, tac_id |
| 169 | tbl_workspace_user | 0 | user | ws_id, user_id |
| 170 | tbl_zip_file | 0 | file, folder, task, volume, hash | id, folder_path, file_name, file_size, hash, hash1, create_date, verify_date, status, task_id, volume_id, bus_status, prove_file_path, chain_id |

---

## Integration Decision

| requirement | source evidence | decision | reason |
|---|---|---|---|
| REQ-5.1.1 logs | `tbl_sys_log` 85 rows (type, operate_type, user_id, task_id, result), `tbl_check_log` 0 rows, `tbl_check_patrol_log` 0 rows | **partial** — integrate `tbl_sys_log` | Real log data exists for system operations. Task-level logs (burn/restore) need `tbl_task` + `tbl_disc` join. Check/patrol logs empty. |
| REQ-5.2.1 index | `tbl_file_*` partitions with hash/hash1, `tbl_slot_file_*` partitions, `tbl_disc` 65 rows, `tbl_slots` 396 rows | **integrate** — direct query with LIMIT | File index has hash columns. No full PG17 ingestion needed. |
| REQ-4.1.1 search | `tbl_file_*` (name, size, content_type), `tbl_disc` (disc info), `tbl_logical_volume` 3 rows, `tbl_user` 3 rows | **partial** — file+disc dimensions available | Department (`tbl_depa` 0 rows) dimension empty. Volume limited (3 rows). |
| REQ-2.3.1 sync range | `tbl_task` 37 rows, `tbl_user` 3 rows, `tbl_user_role` 0 rows, `tbl_device_device` 0 rows | **partial** — task+user available | Device table empty. User-role mapping empty. Permission data absent. |
| REQ-3.1.1 account dims | `tbl_user` 3 rows (role_id, user_type, login_status) | **partial** — 3 users only | Very limited user data. Role mapping (`tbl_user_role`) empty. |
| REQ-3.3.1 department | `tbl_depa` 0 rows, `tbl_depa_user` 0 rows | **blocked_by_source_schema** | Department tables completely empty. |

### Key Source Tables With Real Data

| table | rows | key for |
|---|---:|---|
| tbl_task | 37 | task management, task control |
| tbl_task_items | 47 | task detail, file mapping |
| tbl_disc | 65 | disc status, burn errors |
| tbl_file_2 | 40421 | file index, search, hash |
| tbl_file_3_a | 27658 | file index, search, hash |
| tbl_file_1 | 1773 | file index, search, hash |
| tbl_slots | 396 | slot/disc mapping |
| tbl_sys_log | 85 | system operation logs |
| tbl_user | 3 | user accounts |
| tbl_logical_volume | 3 | volume management |
| tbl_volume_slot | 161 | volume-slot mapping |

### Key Tables Empty (0 rows)

| table | implication |
|---|---|
| tbl_depa | Department management blocked |
| tbl_device_device | Device monitoring blocked |
| tbl_disc_inspect | Disc inspection blocked |
| tbl_check_* (all) | Check/patrol system blocked |
| tbl_hot_restore_record | Hot restore blocked |
| tbl_user_role | RBAC sync blocked |
