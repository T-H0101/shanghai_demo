-- ver 6.5.1
-- name Megafile mysql database sql
-- date 2026.01.22

DROP DATABASE IF EXISTS star_storage_db;
CREATE DATABASE IF NOT EXISTS star_storage_db CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
USE star_storage_db;

SET FOREIGN_KEY_CHECKS=0;
SET global log_bin_trust_function_creators=TRUE;

-- ======================================================
-- 用户可访问文件夹表（tbl_buffer_dir）
-- 每个用户可以有多条可访问文件夹记录
-- ----------------------------
DROP TABLE IF EXISTS `tbl_buffer_dir`;
CREATE TABLE `tbl_buffer_dir` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT '' COMMENT '20251212废弃',
  `pwd` varchar(50) DEFAULT '' COMMENT '20251212废弃',
  `home` varchar(255) DEFAULT '' COMMENT '主目录绝对地址',
  `buffer_type` int DEFAULT 0 COMMENT '目录作用，1作为缓存，2作为缓存不可见',
  `user_id` int NOT NULL COMMENT '目录绑定用户',
  `src_path` varchar(255) DEFAULT '' COMMENT '附加目录',
  `quota_bytes` bigint DEFAULT NULL COMMENT '配额(字节)，NULL=不限制',
  `min_size` bigint DEFAULT 0 COMMENT '每次任务提交文件的大小下限',
  `day_task` int DEFAULT 0 COMMENT '用户每天可创建任务数',
  `archive_clean` int DEFAULT 0 COMMENT '归档缓存清理周期',
  `read_clean` int DEFAULT 0 COMMENT '读取缓存清理周期',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_disc_lib 扩展 设备信息表
-- ----------------------------
DROP TABLE IF EXISTS `tbl_disc_lib`;
CREATE TABLE `tbl_disc_lib` (
  `lib_id` int NOT NULL AUTO_INCREMENT COMMENT '设备id',
  `group_id` int DEFAULT NULL COMMENT '设备所属分组',
  `device_order` int DEFAULT NULL COMMENT '设备显示顺序',
  `device_status` int DEFAULT 0 COMMENT '设备状态，1在线，0离线，2删除，3警告（光驱坏1个），4错误（光驱全坏）',
  `current_device` tinyint DEFAULT NULL COMMENT '当前光盘库为1',
  `name` varchar(200) DEFAULT NULL COMMENT '设备名称',
  `type` int DEFAULT NULL COMMENT '设备类型：1二代库，2二代离线库，3一代旧库，4一代新库，5一代离线库，6三代库，7出版设备，8硬盘库，9磁带库，10磁带机，11新SAS硬盘库，12胶片库，13网盘，14报警器，15四代库',
  `disc_type` int DEFAULT NULL COMMENT '光盘类型ID或设备子类型',
  `IP` varchar(50) DEFAULT NULL COMMENT '设备IP',
  `port` varchar(10) DEFAULT NULL COMMENT '服务端口号',
  `vendor` varchar(50) DEFAULT NULL COMMENT '制造商',
  `model` varchar(50) DEFAULT NULL COMMENT '型号',
  `sn` varchar(50) DEFAULT NULL COMMENT '序列号',
  `mags` int DEFAULT NULL COMMENT '光盘库片匣数，硬盘库托盘数',
  `slots` int DEFAULT NULL COMMENT '设备介质数',
  `slots_per_mag` int DEFAULT NULL COMMENT '光盘库片匣抽片数，硬盘库托盘硬盘数',
  `use_status` tinyint DEFAULT 0 COMMENT 'Windows:0，高速模式（不实际下电）2，Linux:1，高速模式3',
  `lib_user` varchar(50) DEFAULT NULL COMMENT '库共享目录的用户',
  `lib_pwd` varchar(50) DEFAULT NULL COMMENT '库共享目录的密码',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`lib_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_lib_group 设备分组
-- ----------------------------
DROP TABLE IF EXISTS `tbl_lib_group`;
CREATE TABLE `tbl_lib_group` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '设备组id',
  `group_name` varchar(255) DEFAULT NULL COMMENT '设备组名称',
  `parent` bigint DEFAULT 0 COMMENT '父目录ID，为NULL表示根目录',
  `lock_info` varchar(500) DEFAULT NULL COMMENT '设备锁信息',
  `s_level` tinyint DEFAULT 0 COMMENT '组的级别，第一层为0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_disc_type
-- ----------------------------
DROP TABLE IF EXISTS `tbl_disc_type`;
CREATE TABLE `tbl_disc_type` (
  `id` int NOT NULL COMMENT '光盘类型ID',
  `description` varchar(50) DEFAULT NULL COMMENT '光盘描述',
  `disc_cap` bigint DEFAULT NULL COMMENT '单面光盘容量（Byte）',
  `disc_side` tinyint DEFAULT 1 COMMENT '1单面，2双面',
  `cmt` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;  

-- ----------------------------
-- Table structure for tbl_drivers
-- ----------------------------
DROP TABLE IF EXISTS `tbl_drivers`;
CREATE TABLE `tbl_drivers` (
  `driver_id` int NOT NULL AUTO_INCREMENT COMMENT '主键 光驱id',
  `lib_id` int DEFAULT NULL COMMENT '所属光盘库id',
  `drive_order` int DEFAULT NULL COMMENT '所属光盘库中光驱排序',
  `drive_letter` varchar(50) DEFAULT NULL COMMENT '光驱盘符，Linux下为sr0等设备的字符0',
  `sata_num` tinyint DEFAULT NULL COMMENT '光驱对应的SATA开关序号',
  `driver_sn` varchar(50) DEFAULT NULL COMMENT '光驱硬件序列号',
  `start_time` datetime DEFAULT NULL COMMENT '光盘进光驱时间',
  `write_time` int DEFAULT NULL COMMENT '该光驱写光盘时间（分钟）',
  `read_time` int DEFAULT NULL COMMENT '光驱读光盘时间（分钟）',
  `error_times` int DEFAULT 0 COMMENT '光驱读写时发生错误次数',
  `virtual_path` varchar(250) DEFAULT NULL COMMENT '光驱抓取ISO后的挂载路径',
  `drive_status` int DEFAULT 0 COMMENT '光驱状态0正常，为1表示禁用，>1为光驱组别号',
  `buffer_path` varchar(500) DEFAULT NULL COMMENT '光驱生成ISO的缓冲路径',
  `disc_side` tinyint DEFAULT 0 COMMENT '光驱读取双面光盘的面，0为A面，1为B面，与tbl_slots表中的disc_side一致',
  `disc_status` int DEFAULT 0 COMMENT '光驱中光盘地址，0为无光盘',
  `warn_time` int DEFAULT '600' COMMENT '光驱寿命警告时间',
  `swarn_time` int DEFAULT '800' COMMENT '光驱寿命严重警告时间',
  PRIMARY KEY (`driver_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='光驱信息表';

-- ----------------------------
-- Table structure for tbl_drivers_burn
-- ----------------------------
DROP TABLE IF EXISTS `tbl_drivers_burn`;
CREATE TABLE `tbl_drivers_burn` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键 id',
  `driver_sn` varchar(50) DEFAULT NULL COMMENT '光驱序列号',
  `burn_status` tinyint DEFAULT NULL COMMENT '刻录结果：成功100，失败为刻录进程百分比',
  `burn_data` bigint DEFAULT NULL COMMENT '刻录数据量（字节），失败时会减去未成功刻录的数据量',
  `start_time` datetime DEFAULT NULL COMMENT '刻录开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '刻录结束时间',
  `cmt` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='光盘刻录统计表';

-- ----------------------------
-- Table structure for tbl_magzines 扩展 光盘盘笼，硬盘托盘
-- ----------------------------
DROP TABLE IF EXISTS `tbl_magzines`;
CREATE TABLE `tbl_magzines` (
  `mag_id` int NOT NULL AUTO_INCREMENT COMMENT '光盘库片匣ID，离线放置后此ID仍然有效；硬盘库托盘ID',
  `lib_id` int DEFAULT NULL COMMENT '片匣所在设备',
  `RFID` varchar(50) DEFAULT NULL COMMENT '片匣标识',
  `disc_type` int DEFAULT NULL COMMENT '光盘类型ID',
  `mag_order` int DEFAULT NULL COMMENT '片匣在库中的位置，不为空表示在线（从0开始），为空表示离线',
  `door_status` int DEFAULT 0 COMMENT '托盘状态：0关闭，1打开',
  `earliest_time` varchar(20) DEFAULT NULL,
  `latest_time` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`mag_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_slots 扩展 光盘信息，介质信息
-- ----------------------------
DROP TABLE IF EXISTS `tbl_slots`;
CREATE TABLE `tbl_slots` (
  `slot_id` int NOT NULL AUTO_INCREMENT COMMENT '介质ID',
  `mag_id` int NOT NULL COMMENT '介质所在片匣ID',
  `slot_order` int NOT NULL COMMENT '介质在片匣中的序号，从0开始',
  `disc_type` int DEFAULT NULL COMMENT '0空位，1新盘 未使用，2使用完 封盘，3有剩余容量，4损坏，5硬盘格式化中，10中间状态',
  `serial_num` varchar(50) DEFAULT NULL COMMENT '介质序列号，光盘刻录后更新',
  `max_cap` bigint DEFAULT NULL COMMENT '总容量',
  `rest_cap` bigint DEFAULT NULL COMMENT '刻录前为光盘容量（Byte），刻录后为安全容量（减去安全冗余）',
  `disc_side` int DEFAULT 0 COMMENT '光盘AB面指示，0表示A面，1表示B面',
  `hd_type` int DEFAULT 0 COMMENT '介质类型，0光盘，1硬盘，2磁带，3阵列',
  `group_id` int DEFAULT NULL COMMENT '组序号',
  `cmt` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`slot_id`),
  KEY `index_group_id` (`group_id`) USING BTREE COMMENT '组索引，用于加快速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- 新增 硬盘详细信息
-- ----------------------------
DROP TABLE IF EXISTS `tbl_hd_info`;
CREATE TABLE `tbl_hd_info` (
  `slot_id` int NOT NULL AUTO_INCREMENT COMMENT '介质ID',
  `serial_num` varchar(50) NOT NULL COMMENT '硬盘序列号',
  `name` varchar(50) DEFAULT NULL COMMENT '介质名称',
  `model` varchar(100) DEFAULT NULL COMMENT '介质型号标注',
  `asset_num` varchar(100) DEFAULT NULL COMMENT '资产编号',
  `file_sys` varchar(50) DEFAULT NULL COMMENT '文件系统',
  `file_path` varchar(1000) DEFAULT NULL COMMENT '硬盘挂载路径',
  `create_dt` datetime DEFAULT NULL COMMENT '介质添加时间',  
  `full_check_set` int DEFAULT 0 COMMENT '自动全检间隔时间设置，单位月，0不启用',
  `last_fullcheck_dt` datetime DEFAULT NULL COMMENT '上次全检时间',
  `select_check_set` int DEFAULT 0 COMMENT '自动抽检间隔时间设置，单位天，0不启用',
  `last_selectcheck_dt` datetime DEFAULT NULL COMMENT '上次抽检时间',
  `power_set` int DEFAULT 0 COMMENT '自动加电间隔时间设置，单位天，0不启用',
  `last_power_dt` datetime DEFAULT NULL COMMENT '上次加电时间',
  `health` int DEFAULT '100' COMMENT '健康度(90以上为正常)',
  `last_mount_dt` datetime DEFAULT NULL COMMENT '上次挂载时间',
  `last_online_dt` datetime DEFAULT NULL COMMENT '最后在线时间',
  `hd_status` int DEFAULT 0 COMMENT '0外部盘，1内置盘，2归档盘',
  `hd_online` tinyint DEFAULT 0 COMMENT '0离线，1在线下电，2在线上电',
  `read_only` int DEFAULT 0 COMMENT '0读写，1只读',
  `smart` text DEFAULT NULL COMMENT 'smart信息',
  `raid_type` varchar(50) DEFAULT NULL COMMENT 'raid类型:1数据盘，2校验盘',
  `raid_vid` int DEFAULT NULL COMMENT 'raid_vid',
  `alarm_times` int DEFAULT 0 COMMENT '报警次数',
  `last_alarm_dt` datetime DEFAULT NULL COMMENT '最后报警时间',
  PRIMARY KEY (`slot_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1000000 CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- 新增 硬盘加电记录
-- ----------------------------
DROP TABLE IF EXISTS `tbl_hd_power`;
CREATE TABLE `tbl_hd_power` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `task_id` bigint DEFAULT NULL COMMENT '任务 id',
  `lib_id` int DEFAULT NULL COMMENT '所属光盘库id',
  `mag_id` int NOT NULL COMMENT '介质所在片匣ID',
  `slot_order` int NOT NULL COMMENT '介质在片匣中的序号，从0开始',
  `serial_num` varchar(50) NOT NULL COMMENT '硬盘序列号',
  `duration` int DEFAULT 0 COMMENT '加电时长，单位小时',
  `up_dt` datetime DEFAULT NULL COMMENT '加电时间',
  `down_dt` datetime DEFAULT NULL COMMENT '下电时间',
  `status` tinyint DEFAULT 0 COMMENT '0未执行，1完成，2上电，3离线',
  `smart` text DEFAULT NULL COMMENT 'smart信息',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- 新增 硬盘分区信息
-- ----------------------------
DROP TABLE IF EXISTS `tbl_slots_part`;
CREATE TABLE `tbl_slots_part` (
  `part_id` bigint NOT NULL AUTO_INCREMENT COMMENT '分区ID',
  `serial_num` varchar(50) NOT NULL COMMENT '硬盘序列号',
  `part_name` varchar(100) DEFAULT NULL COMMENT '分区名称',
  `file_sys` varchar(50) DEFAULT NULL COMMENT '文件系统',
  `max_cap` bigint DEFAULT NULL COMMENT '总容量',
  `rest_cap` bigint DEFAULT NULL COMMENT '剩余容量',
  PRIMARY KEY (`part_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_disc
-- ----------------------------
DROP TABLE IF EXISTS `tbl_disc`;
CREATE TABLE `tbl_disc` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键 id',
  `task_id` bigint DEFAULT NULL COMMENT '任务 id',
  `disc_num` int DEFAULT NULL COMMENT '所属任务的光盘分配序号',
  `slot_id` int DEFAULT NULL COMMENT '所属抽片 id（tbl_slots.slot_id）',
  `src_slot` int DEFAULT NULL COMMENT '复制光盘原来位置slot id',
  `burn_success` int DEFAULT 1 COMMENT '刻录状态：1 成功，0 未刻录，-1刻录失败会重刻，-2刻录失败不重刻',
  `copy_success` int DEFAULT 1 COMMENT '回迁状态：1 成功，0 未开始，-2光盘无法再刻录',
  `disc_label` varchar(50) DEFAULT NULL COMMENT '光盘名称，可以用来修改光盘名称',
  `burn_device` varchar(50) DEFAULT NULL COMMENT '刻录光驱盘符',
  `used_size` bigint DEFAULT NULL COMMENT '此任务光盘的总文件大小',
  `extra_size` bigint DEFAULT 0 COMMENT '此任务光盘的附加文件（如说明文件等）大小',
  `serial_num` varchar(50) DEFAULT NULL COMMENT '光盘序列号',
  `disc_progress` tinyint DEFAULT NULL COMMENT '光盘刻录或校验进度',
  `stage` tinyint DEFAULT NULL COMMENT '0开始刻录, 1刻录完成, 2开始校验, 3开始3重校验，4已经成功校验过，5已经校验过但失败',
  `burn_errors` tinyint DEFAULT NULL COMMENT '刻录或校验失败时此值置为1',
  `burn_retry` tinyint DEFAULT 0 COMMENT '刻录失败后重刻光盘次数',
  `error_files` int DEFAULT 0 COMMENT '刻录后校验失败的文件数',
  `prepare_seconds` int DEFAULT '-1' COMMENT '当前盘刻录准备时间',
  `ret_msg` varchar(4096) DEFAULT NULL COMMENT '刻录状态信息',
  `ret_value` int DEFAULT '-1' COMMENT '当前盘刻录进程返回值',
  `iso_status` tinyint DEFAULT NULL COMMENT '0未生成，1已准备好ISO，2正在刻录ISO，3刻录ISO成功，4文件数多回迁先生成ISO，5光盘回迁，6多份拷贝刻录时保留ISO，7检查ISO失败，10正在生成ISO，11生成ISO错误，12不需要或无法生成ISO',
  `iso_path` varchar(1000) DEFAULT NULL,
  `create_dt` datetime DEFAULT NULL COMMENT '刻录开始时间',
  `update_dt` datetime DEFAULT NULL COMMENT '刻录结束时间',
  `verify_dt` datetime DEFAULT NULL COMMENT '校验结束时间',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `index_slot_id` (`slot_id`) USING BTREE COMMENT '光盘表索引，用于加快联合查询速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='文件刻录光盘分配表';

-- ----------------------------
-- Table structure for tbl_disc_print
-- ----------------------------
DROP TABLE IF EXISTS `tbl_disc_print`;
CREATE TABLE `tbl_disc_print` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键 id',
  `disc_id` int NOT NULL COMMENT 'disc id',
  `dat_path` varchar(1000) DEFAULT NULL COMMENT '模板数据文件',
  `data_list` varchar(1000) DEFAULT NULL COMMENT '刻录数据文件',
  `uuid` varchar(50) DEFAULT NULL COMMENT '对应刻录打印任务的job_id',
  `print_img` varchar(1000) DEFAULT NULL COMMENT '打印图片',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `index_disc_id` (`disc_id`) USING BTREE COMMENT '光盘表索引，用于加快联合查询速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='光盘打印表';

-- ----------------------------
-- Table structure for tbl_task
-- ----------------------------
DROP TABLE IF EXISTS `tbl_task`;
CREATE TABLE `tbl_task` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '刻录或回迁任务ID，应用端先生成任务ID，其他后续流程此ID为基准',
  `uuid` varchar(64) DEFAULT NULL,
  `split_level` int DEFAULT 0 COMMENT '为0不分割文件，N>0表示不分割第N级目录，为-1分割大于光盘的文件',
  `task_type` int DEFAULT NULL COMMENT '0备份任务，1恢复任务，2刻录并直接封盘，3接口任务，4扫描任务，5磁光复制任务，6卷复制任务，7 S3任务，8封包任务，9存证任务，10 加电任务，11异地热备任务',
  `create_dt` datetime DEFAULT NULL COMMENT '任务创建日期',
  `update_dt` datetime DEFAULT NULL COMMENT '刻录更新日期',
  `status` int DEFAULT 1 COMMENT '任务状态，刻录任务时为6表示准备好，回迁任务时为1表示准备好,2任务取消,3接口任务准备好',
  `burn_status` tinyint DEFAULT 0 COMMENT '0已完成数据库表合并，2视频任务只下载不刻录，3同时有在线和离线盘笼，4未完成数据库表合并，>=10指定任务密级',
  `task_name` varchar(255) DEFAULT NULL COMMENT '任务名称',
  `extension_filter` varchar(50) DEFAULT NULL COMMENT '刻录归档目录',
  `json_path` text COMMENT '任务接口文件',
  `slot_start` int DEFAULT NULL COMMENT '任务起始slot id，指定磁带id',
  `slot_type` int DEFAULT 0 COMMENT '3光盘打印，其他0',
  `task_mode` tinyint DEFAULT 0 COMMENT '刻录模式（0：顺序刻录，1：并行刻录，2：视频合并顺序刻录，3：视频合并并行刻录）',  
  `burn_mode` tinyint DEFAULT 1 COMMENT '刻录方式（一次性刻录0或追加刻录1）',
  `burn_speed` int DEFAULT 0 COMMENT '刻录速度（默认为最大速度）, 巡检比例',
  `verify_mode` tinyint DEFAULT 1 COMMENT '校验模式（ 不校验0，文件校验1，快速校验2，双重校验3，光盘介质检测4）',
  `save_hash` tinyint DEFAULT '2' COMMENT '保存校验码（ 不保存校验码0，CRC32: 1，MD5: 2）',
  `encrypt` varchar(255) DEFAULT NULL COMMENT '光盘加密密码（为空表示不加密）',
  `add_csv` tinyint DEFAULT 0 COMMENT '添加光盘目录文件（添加1，不添加0）',
  `raid_groups` varchar(100) DEFAULT NULL COMMENT 'RAID组集合',
  `use_buffer` tinyint DEFAULT 1 COMMENT '使用缓存（使用1，不使用0）',
  `delete_files` tinyint DEFAULT 0 COMMENT '封盘后是否删除源文件（删除1，不删除0，2移动或拷贝到另外的目录，3异地S3备份，4异地共享备份）',
  `copy_files` tinyint DEFAULT 0 COMMENT '是否拷贝文件到本地（拷贝1，不拷贝0）',
  `copy_source` tinyint DEFAULT 0 COMMENT '回迁时是否优先拷贝源文件（是1，否0）',
  `copies` tinyint DEFAULT 0 COMMENT '多副本刻录（副本数）',
  `split_mode` tinyint DEFAULT 0 COMMENT '任务切分方法（0按数据容量顺序分配，1按最高存储效率分配，2按文档类型，3按文件时间，4按光盘类型自动选择）',
  `prefix` varchar(50) DEFAULT NULL COMMENT '光盘标签前缀',
  `start_num` int DEFAULT 1 COMMENT '光盘标签起始数字',
  `add_zero` tinyint DEFAULT NULL COMMENT '光盘标签补零个数',
  `total_files` bigint DEFAULT 0 COMMENT '任务总文件数',
  `total_size` bigint DEFAULT 0 COMMENT '任务总文件大小',
  `encoding` tinyint DEFAULT 0 COMMENT '任务重新刻录次数',
  `max_disc` int DEFAULT 0 COMMENT '上一次刻录时的最大disc id',
  `data_source` int DEFAULT 0 COMMENT '数据来源：0本地任务，1计划任务，2视频下载任务，1000000+异地备份taskId表示已备份成功',
  `ret_value` int DEFAULT '-1' COMMENT '当前MakeTask任务进程返回值',
  `ret_msg` varchar(1000) DEFAULT NULL COMMENT '任务状态信息',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_task_folder
-- ----------------------------
DROP TABLE IF EXISTS `tbl_task_folder`;
CREATE TABLE `tbl_task_folder` (
  `task_id` bigint NOT NULL COMMENT '刻录或回迁任务ID',
  `volume_id` int NOT NULL COMMENT '存储卷ID',
  `min_folder_id` bigint NOT NULL COMMENT '创建任务前的最大folder_id',
  `max_folder_id` bigint DEFAULT NULL COMMENT '创建任务完成后的最大folder_id',
  `cmt` varchar(200) DEFAULT NULL COMMENT '补充说明',
  PRIMARY KEY (`task_id`,`volume_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_task_items
-- ----------------------------
DROP TABLE IF EXISTS `tbl_task_items`;
CREATE TABLE `tbl_task_items` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `task_id` bigint NOT NULL COMMENT '归档（或回迁）任务ID',
  `root_path` varchar(1024) NOT NULL COMMENT '归档（或回迁）缓冲目录全路径',
  `original_path` varchar(1024) DEFAULT NULL COMMENT '归档目录全路径',
  `item_name` varchar(500) DEFAULT NULL COMMENT '目录名或文件名（单级）',
  `volume_id` int NOT NULL COMMENT '逻辑卷ID',
  `lib_parent_folder` varchar(500) NOT NULL COMMENT '光盘库逻辑卷下的父目录全路径',
  `is_folder` tinyint DEFAULT 0 COMMENT '文件0，目录1，需预先解压的ZIP文件2',
  `slot_id` int DEFAULT NULL COMMENT '回迁光盘下的目录时填光盘slot id',
  `status` int DEFAULT 0 COMMENT '>0 复制任务的源卷ID或S3归档任务数据来源tbl_mount_dir的ID；巡检任务的结果状态',
  `project_id` int DEFAULT NULL COMMENT '视频归档项目ID',
  `cmt` varchar(200) DEFAULT NULL COMMENT '补充说明',
  PRIMARY KEY (`id`),
  KEY `index_task_id` (`task_id`) USING BTREE COMMENT '光盘表索引，用于加快联合查询速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_folder
-- ----------------------------
DROP TABLE IF EXISTS `tbl_folder`;
CREATE TABLE `tbl_folder` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `name` varchar(1000) NOT NULL COMMENT '本级目录名称',
  `folder_path` varchar(4096) DEFAULT '' COMMENT '原目录全路径',
  `disc_path` varchar(4096) DEFAULT '' COMMENT '光盘目录全路径，为空则表示与原目录相同',
  `s_level` int DEFAULT NULL COMMENT '相对于根目录的级别，根目录为0',
  `parent` bigint DEFAULT 0 COMMENT '父目录ID，为NULL表示根目录',
  `sum_files` bigint DEFAULT NULL COMMENT '此目录下的文件总大小（不分割第N级目录时会汇总子目录）',
  `files` int DEFAULT 0 COMMENT '本目录下的文件数（不包含子目录）',
  `subs` int DEFAULT 0 COMMENT '本目录下子目录数，-1表示删除',
  PRIMARY KEY (`id`),
  KEY `index_parent` (`parent`) USING BTREE COMMENT '父目录索引，用于加快回迁速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_file
-- ----------------------------
DROP TABLE IF EXISTS `tbl_file`;
CREATE TABLE `tbl_file` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID（数字型）',
  `uuid` varchar(64) DEFAULT NULL COMMENT '文件ID（字符型）',
  `folder_id` bigint NOT NULL COMMENT '文件存放目录，对应的目录ID',
  `file_name` varchar(765) DEFAULT NULL COMMENT '文件名称',
  `file_remark` varchar(765) DEFAULT NULL COMMENT '文件别名',
  `file_disc_name` varchar(500) DEFAULT NULL COMMENT '文件在光盘上的名称，如果重复可能会增加.1,.2等',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `hash` varchar(65) DEFAULT NULL COMMENT '文件校验码',
  `hash1` varchar(65) DEFAULT NULL COMMENT '外部归档硬盘或巡检介质校验检查时的文件校验码，或加密刻录容器文件名，或磁带ISO文件名',
  `task_id` bigint DEFAULT NULL COMMENT '回迁或者迁入的任务ID',
  `items_id` bigint NOT NULL COMMENT 'tbl_task_items的ID，用于查询root_path与库父路径',
  `create_date` datetime DEFAULT NULL COMMENT '文件归档时间',
  `status` tinyint DEFAULT 1 COMMENT '文件状态 1普通文件 2大文件不刻录 3大文件切分子文件 4标示虚拟文件5 删除文件 6重复文件',
  `burn_times` tinyint DEFAULT 1 COMMENT '文件刻录次数',
  `slot_id` int DEFAULT NULL COMMENT '文件所在光盘slot id',
  `content_type` varchar(65) DEFAULT NULL COMMENT '文件MIME类型',
  `storage_class` tinyint DEFAULT 0 COMMENT '对象的存储类别，如0:STANDARD（磁缓冲区），1:STANDARD_IA（磁+光），2:GLACIER（在线光），3:GLACIER_DA（离线光）,4:S3_IT',
  `thumbs` tinyint DEFAULT 0 COMMENT '缩略图 0可抓取，1已生成，2不需要，3需要GBK转码，4下载S3，5需要二进制转义 >=10文件密级',
  `meta_data` varchar(1000) DEFAULT NULL COMMENT '文件元数据',
  PRIMARY KEY (`id`),
  KEY `index_folder_id` (`folder_id`) USING BTREE COMMENT '目录表索引，用于加快回迁速度',
  KEY `index_slot_id` (`slot_id`) USING BTREE COMMENT '光盘表索引，用于加快刻录速度',
  KEY `index_items_id` (`items_id`) USING BTREE COMMENT '任务表索引，用于加快刻录速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_zip_file
-- ----------------------------
DROP TABLE IF EXISTS `tbl_zip_file`;
CREATE TABLE `tbl_zip_file` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `folder_path` varchar(765) NOT NULL COMMENT '文件路径',
  `file_name` varchar(765) NOT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `hash` varchar(65) DEFAULT NULL COMMENT '文件校验码',
  `hash1` varchar(65) DEFAULT NULL COMMENT '巡检介质校验检查时的文件校验码',
  `create_date` datetime DEFAULT NULL COMMENT '文件归档时间',
  `verify_date` datetime DEFAULT NULL COMMENT '文件校验时间',
  `status` tinyint DEFAULT 0 COMMENT '文件状态 1已生成 2已校验 3已归档 5已删除',
  `format` tinyint DEFAULT 0 COMMENT '封包格式 0:ISO 1:ZIP',
  `compress` tinyint DEFAULT 0 COMMENT '压缩率 0不压缩 1最快 9最高',
  `encrypt` varchar(500) DEFAULT NULL COMMENT '压缩文件密码',
  `task_id` bigint DEFAULT NULL COMMENT '任务ID',
  `file_count` bigint DEFAULT NULL COMMENT '文件数量',
  `archival_code` varchar(50) DEFAULT NULL COMMENT '分类编码',
  `volume_id` int DEFAULT NULL COMMENT '卷ID',
  `bus_status` tinyint DEFAULT 0 COMMENT '业务状态：0待生成csv， 1：已生成csv，2：已存证',
  `prove_file_path` varchar(500) DEFAULT NULL COMMENT '存证证书路径',
  `chain_id` varchar(255) DEFAULT NULL COMMENT '证据链id',
  `data_code` varchar(50) DEFAULT NULL COMMENT '数据分类',
  `hash2` varchar(65) DEFAULT NULL COMMENT '实际iso的校验码',
  `meta_data` varchar(1000) DEFAULT NULL COMMENT 'iso文件meta信息',
  `is_delete` tinyint DEFAULT 0 COMMENT '0正常1删除',
  `csv_hash` varchar(65) DEFAULT NULL COMMENT 'fileinfo文件校验码',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2000000 CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_file_parts
-- ----------------------------
DROP TABLE IF EXISTS `tbl_file_parts`;
CREATE TABLE `tbl_file_parts` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `volume_id` int DEFAULT NULL COMMENT '卷ID',
  `file_id` bigint DEFAULT NULL COMMENT '大文件ID',
  `split_file_id` bigint DEFAULT NULL COMMENT '子文件ID',
  `status` tinyint DEFAULT 0 COMMENT '切分删除文件状态，0未删除，1已删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_ft_file
-- ----------------------------
DROP TABLE IF EXISTS `tbl_ft_file`;
CREATE TABLE `tbl_ft_file` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `task_id` bigint DEFAULT NULL COMMENT '任务ID',
  `slot_id` int DEFAULT NULL COMMENT 'file_id所在的光盘',
  `burn_success` int DEFAULT NULL COMMENT 'file_id是否已成功刻录到光盘上',
  `volume_id` int NOT NULL COMMENT '存储卷ID',
  `file_id` bigint DEFAULT NULL COMMENT '文件表中的文件ID',
  `items_id` bigint DEFAULT NULL COMMENT '回迁文件根目录，对应的tbl_task_items表ID',
  `size` bigint DEFAULT NULL COMMENT '文件大小',
  `status` tinyint DEFAULT 1 COMMENT '1待处理，6回迁成功，7离线，9回迁失败',
  `storage_status` tinyint DEFAULT 0 COMMENT '0仅光盘  1磁盘',
  `restored_name` varchar(1024) DEFAULT NULL COMMENT '文件回迁名称，恢复成原来的名称',
  PRIMARY KEY (`id`),
  KEY `index_file_id` (`file_id`) USING BTREE COMMENT '文件索引，用于加快回迁速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_monitor_path
-- ----------------------------
DROP TABLE IF EXISTS `tbl_monitor_path`;
CREATE TABLE `tbl_monitor_path` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `file_path` varchar(1024) NOT NULL COMMENT '监听目录全路径',
  `table_ids` varchar(1024) DEFAULT NULL COMMENT '对应文件表的卷ID集合，至少两个轮换，如：1000000,1000001',
  `last_table_id` bigint DEFAULT NULL COMMENT '上一次扫描时文件保存的卷ID',
  `last_time` datetime DEFAULT NULL COMMENT '上一次扫描时间',
  `total_size` bigint DEFAULT 0 COMMENT '上一次扫描完成后监控目录总文件大小',
  `cmt` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_task_files
-- ----------------------------
DROP TABLE IF EXISTS `tbl_task_files`;
CREATE TABLE `tbl_task_files` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `file_path` varchar(1024) NOT NULL COMMENT '文件全路径',
  `file_size` bigint NOT NULL COMMENT '文件大小',
  `close_time` datetime DEFAULT NULL COMMENT '文件关闭时间',
  `monitor_id` int NOT NULL COMMENT '监听目录表ID',
  `cmt` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_raid_group
-- ----------------------------
DROP TABLE IF EXISTS `tbl_raid_group`;
CREATE TABLE `tbl_raid_group` (
  `group_id` int NOT NULL AUTO_INCREMENT,
  `data_num` int NOT NULL COMMENT '数据盘个数',
  `parity_num` int NOT NULL COMMENT '校验盘个数',
  `parity_path` varchar(255) DEFAULT NULL COMMENT '检验文件路径',
  `volume_id` int NOT NULL COMMENT 'parity_path所在逻辑卷ID',
  `cmt` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`group_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_user
-- ----------------------------
DROP TABLE IF EXISTS `tbl_user`;
CREATE TABLE `tbl_user` (
  `user_id` int NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `role_id` int DEFAULT NULL COMMENT '角色id',
  `uuid` varchar(64) DEFAULT NULL,
  `name` varchar(30) DEFAULT NULL COMMENT '用户名称',
  `display_name` varchar(100) DEFAULT NULL COMMENT '显示名称/昵称',
  `title` varchar(50) DEFAULT NULL COMMENT '用户职位',
  `department` varchar(100) DEFAULT NULL COMMENT '用户部门',
  `pwd` varchar(255) DEFAULT NULL COMMENT '密码加密字符串或密码哈希',
  `password_algo` int DEFAULT 0 COMMENT 'pwd算法：0哈希 1加密',
  `password_salt` varchar(128) DEFAULT NULL COMMENT '可选，哈希盐',
  `phone` varchar(11) DEFAULT NULL COMMENT '用户联系方式',
  `email` varchar(50) DEFAULT NULL COMMENT '邮箱',
  `login_status` tinyint DEFAULT NULL COMMENT '用户登录状态',
  `user_type` tinyint DEFAULT 0 COMMENT '0:客户端登录用户 1：管理员 2:接口/服务账号 3登录+接口',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `expiration_time` datetime DEFAULT NULL COMMENT '有效时间',
  `create_user` varchar(50) DEFAULT NULL,
  `update_user` varchar(50) DEFAULT NULL,
  `root_dir` varchar(255) DEFAULT NULL COMMENT '20251212废弃',
  `root_pwd` varchar(32) DEFAULT NULL COMMENT '接口登录密钥',
  `share_type` tinyint DEFAULT NULL COMMENT '20251212废弃',
  `face_path` varchar(255) DEFAULT NULL COMMENT '20251212废弃',
  `face_id` int DEFAULT NULL COMMENT '20251212废弃',
  `finger_id` int DEFAULT NULL COMMENT '20251212废弃',
  `login_error_times` int DEFAULT 0 COMMENT '用户登录失败次数',
  `login_lock_time` datetime DEFAULT NULL COMMENT '用户登录失败超过次数被锁定的时间',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ======================================================
-- 多因素身份认证表（tbl_user_mfa）
-- 一个用户可以有多条 MFA 记录（TOTP、SMS、Email、Face、Fingerprint）
-- ======================================================
DROP TABLE IF EXISTS `tbl_user_mfa`;
CREATE TABLE `tbl_user_mfa` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `mfa_type` tinyint NOT NULL COMMENT '1=TOTP,2=SMS,3=EMAIL,4=FACE,5=FINGERPRINT,6=U2F',
  `credential` varchar(512) DEFAULT NULL COMMENT '加密存储的密钥/模板/设备ID（例如TOTP secret或加密的face template）',
  `credential_addition` varchar(512) DEFAULT NULL COMMENT 'face头像路径等',
  `display_name` varchar(100) DEFAULT NULL COMMENT '表示名（例如短信/微信授权）',
  `is_enabled` tinyint NOT NULL DEFAULT 1,
  `is_primary` tinyint NOT NULL DEFAULT 0 COMMENT '是否作为首选/默认 MFA 手段',
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ----------------------------
-- 用户分配介质
-- ----------------------------
DROP TABLE IF EXISTS `tbl_user_slots`;
CREATE TABLE `tbl_user_slots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `lib_id` int DEFAULT NULL,
  `mag_id` int DEFAULT NULL,
  `slot_id` int DEFAULT NULL,
  `ctrl_range` int DEFAULT 0 COMMENT '作用范围，0只包含自己，1包含子层',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- ----------------------------
-- Table structure for tbl_logical_volume
-- ----------------------------
DROP TABLE IF EXISTS `tbl_logical_volume`;
CREATE TABLE `tbl_logical_volume` (
  `volume_id` int NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `group_id` int DEFAULT 0 COMMENT '所属卷组',
  `type` tinyint DEFAULT 1 COMMENT '1光盘卷；2磁盘卷（NAS）；3硬盘卷；5磁带库卷；6光盘校验卷；7磁带机卷；8接收中转卷',
  `uuid` varchar(64) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL COMMENT '逻辑卷名称',
  `total_cap` bigint DEFAULT NULL COMMENT '逻辑卷的总容量 单位：B',
  `used_cap` bigint DEFAULT NULL COMMENT '逻辑卷的已用容量 单位：B',
  `free_cap` bigint DEFAULT NULL COMMENT '逻辑卷的可用容量 单位：B',
  `max_file_id` bigint DEFAULT 0 COMMENT '本卷最大文件ID',
  `create_time` datetime DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `create_user` varchar(50) DEFAULT NULL,
  `update_user` varchar(50) DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL COMMENT '数据盘+校验盘',
  `mount_id` int DEFAULT NULL COMMENT '被挂载的目录的id或校验卷关联的光盘卷',
  `del_flag` tinyint DEFAULT 0 COMMENT '卷的删除标志  0:正常  1:已删除  2:只读 3:光盘接收卷 9:出版系统卷',
  PRIMARY KEY (`volume_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- 新增 卷组
-- ----------------------------
DROP TABLE IF EXISTS `tbl_volume_group`;
CREATE TABLE `tbl_volume_group` (
  `group_id` int NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `name` varchar(255) DEFAULT NULL COMMENT '名称',
  `com_mode` tinyint DEFAULT 0 COMMENT '组合方式 0不同步，1同步',
  `del_flag` tinyint DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`group_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_volume_user
-- ----------------------------
DROP TABLE IF EXISTS `tbl_volume_user`;
CREATE TABLE `tbl_volume_user` (
  `volume_id` int NOT NULL COMMENT '逻辑卷编号',
  `user_id` int NOT NULL COMMENT '用户编号',
  `permission` int DEFAULT NULL COMMENT '0：可检索，1：可读可写 2只读可回迁',
  `current_vol` tinyint DEFAULT 0 COMMENT '1表示接口用户当前使用的卷',
  PRIMARY KEY (`volume_id`,`user_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
-- ----------------------------
-- Table structure for tbl_workspace_user
-- ----------------------------
DROP TABLE IF EXISTS `tbl_workspace_user`;
CREATE TABLE `tbl_workspace_user` (
  `ws_id` int NOT NULL COMMENT '组合卷编号',
  `user_id` int NOT NULL COMMENT '用户编号',
  `permission` int DEFAULT NULL COMMENT '0：可检索，1：可读可写 2只读可回迁',
  PRIMARY KEY (`ws_id`,`user_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
-- ----------------------------
-- Table structure for tbl_volume_slot
-- ----------------------------
DROP TABLE IF EXISTS `tbl_volume_slot`;
CREATE TABLE `tbl_volume_slot` (
  `volume_id` int NOT NULL COMMENT '逻辑卷编号',
  `slot_id` int NOT NULL COMMENT '介质编号',
  `on_line` tinyint DEFAULT 1 COMMENT '在线为>=1，借出或离线为0',
  `slot_num` bigint COMMENT '介质编号序号',
  `slot_code` text COMMENT '介质编号',
  PRIMARY KEY (`volume_id`,`slot_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_user_task
-- ----------------------------
DROP TABLE IF EXISTS `tbl_user_task`;
CREATE TABLE `tbl_user_task` (
  `user_id` int NOT NULL,
  `task_id` bigint NOT NULL,
  `machine_uuid` varchar(100) DEFAULT NULL COMMENT '创建任务的机器的UUID',
  `os_platform` varchar(50) DEFAULT NULL COMMENT '创建任务的机器的操作系统类型',
  `os_arch` varchar(50) DEFAULT NULL COMMENT '创建任务的机器的CPU架构',
  `os_hostname` varchar(100) DEFAULT NULL COMMENT '创建任务的机器的主机名称',
  `user_name` varchar(100) DEFAULT NULL COMMENT '登录用户的姓名',
  `user_agent` varchar(200) DEFAULT NULL COMMENT '客户端代理，一般为浏览器端信息，或者NW代表桌面访问模式',
  `customer_buildversion` varchar(20) DEFAULT NULL COMMENT '客户端的版本号',
  `customer_builddate` varchar(30) DEFAULT NULL COMMENT '客户端的版本日期',
  `user_stage_acting` varchar(30) DEFAULT NULL COMMENT 'uploading, burning, downloading, pre,post',
  `user_stage_failedcount` int DEFAULT NULL,
  `user_stage_faileddate` datetime DEFAULT NULL,
  `userName` varchar(100) DEFAULT NULL COMMENT '登录用户的姓名',
  `userAgent` varchar(200) DEFAULT NULL COMMENT '客户端代理，一般为浏览器端信息，或者NW代表桌面访问模式',
  `customerBuildVersion` varchar(20) DEFAULT NULL COMMENT '客户端的版本号',
  `customerBuildDate` varchar(30) DEFAULT NULL COMMENT '客户端的版本日期',
  `userStageActing` varchar(30) DEFAULT NULL COMMENT 'uploading, burning, downloading, pre,post',
  `userStageFailedCount` int DEFAULT NULL,
  `userStageFailedDate` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`,`task_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_task_check
-- ----------------------------
DROP TABLE IF EXISTS `tbl_task_check`;
CREATE TABLE `tbl_task_check` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `lib_id` int DEFAULT NULL COMMENT '光盘库ID',
  `driver` varchar(50) DEFAULT NULL COMMENT '光盘库中的检测光驱（可能有多个）',
  `mode` int DEFAULT NULL COMMENT '检测模式：0全检，1 SPOT1，2 SPOT2',
  `verify_std` int DEFAULT NULL COMMENT '检测标准',
  `batch` int DEFAULT NULL COMMENT '批次量',
  `aql` varchar(20) DEFAULT NULL COMMENT '标准中的AQL',
  `accept` int DEFAULT NULL COMMENT '接受数',
  `reject` int DEFAULT NULL COMMENT '拒受数',
  `discs` int DEFAULT NULL COMMENT '检测光盘数，根据批次量计算出',
  `ignored` int DEFAULT NULL,
  `spot` varchar(50) DEFAULT NULL,
  `person` varchar(50) DEFAULT NULL,
  `date` varchar(50) DEFAULT NULL,
  `cmt` varchar(500) DEFAULT NULL,
  `slot_start` int DEFAULT NULL COMMENT '光盘库开始检测的抽片号',
  `slot_end` int DEFAULT NULL COMMENT '光盘库结束检测的抽片号',
  `status` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_disk_check
-- ----------------------------
DROP TABLE IF EXISTS `tbl_disk_check`;
CREATE TABLE `tbl_disk_check` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `task_id` bigint NOT NULL,
  `hd_sn` varchar(100) DEFAULT NULL COMMENT '硬盘序列号',
  `volume_id` int DEFAULT NULL COMMENT '硬盘对应的卷号',
  `check_mode` int DEFAULT 0 COMMENT '0更新SMART，1全检MD5，2抽检MD5',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_check_file
-- ----------------------------
DROP TABLE IF EXISTS `tbl_check_file`;
CREATE TABLE `tbl_check_file` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID（数字型）',
  `folder_id` bigint NOT NULL COMMENT '文件存放目录，对应的目录ID',
  `file_name` varchar(765) DEFAULT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `hash` varchar(65) DEFAULT NULL COMMENT '文件校验码',
  `task_id` bigint DEFAULT NULL COMMENT '校验任务ID',
  `volume_id` int DEFAULT NULL COMMENT '校验盘对应卷ID',
  PRIMARY KEY (`id`),
  KEY `index_folder_id` (`folder_id`) USING BTREE COMMENT '目录表索引，用于加快回迁速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_error_rate
-- ----------------------------
DROP TABLE IF EXISTS `tbl_error_rate`;
CREATE TABLE `tbl_error_rate` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `check_id` int DEFAULT NULL COMMENT '检测任务ID',
  `slot_id` int DEFAULT NULL COMMENT '检测光盘slot id',
  `disc_sn` varchar(100) DEFAULT NULL COMMENT '检测光盘序列号',
  `result` varchar(500) DEFAULT NULL COMMENT '检测结果',
  `date` varchar(50) DEFAULT NULL COMMENT '检测日期',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_mount_dir
-- ----------------------------
DROP TABLE IF EXISTS `tbl_mount_dir`;
CREATE TABLE `tbl_mount_dir` (
  `id` int NOT NULL AUTO_INCREMENT,
  `encoding` tinyint DEFAULT 0 COMMENT '路径编码 UTF8:0,GBK:1,UTF16:2,UTF32:3',
  `protocol` tinyint DEFAULT NULL COMMENT '挂载协议类型 1：NFS ,2：CIFS, 3:FTP, 4:SFTP, 5:S3, 6:S3不挂载',
  `src_path` varchar(255) DEFAULT NULL,
  `manager_path` varchar(255) DEFAULT NULL,
  `mount_point` varchar(255) DEFAULT NULL,
  `user_name` varchar(50) DEFAULT NULL,
  `pwd` varchar(50) DEFAULT NULL,
  `quota_bytes` BIGINT DEFAULT NULL COMMENT '配额(字节)，NULL=不限制',
  `mount_date` datetime DEFAULT NULL,
  `buffer_flag` tinyint DEFAULT 0 COMMENT '0 不是默认缓冲区  1 是默认缓冲区 只有一个默认缓冲区',
  `extra_param` varchar(255) DEFAULT NULL,
  `permission` tinyint DEFAULT 0 COMMENT '权限 0读写，1只读',
  `max_speed` int DEFAULT NULL COMMENT '限速 单位MB/s',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_escape for Restful API
-- ----------------------------
DROP TABLE IF EXISTS `tbl_escape`;
CREATE TABLE `tbl_escape` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exp` varchar(20) DEFAULT NULL,
  `rep` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_file_path_archive for Restful API
-- ----------------------------
DROP TABLE IF EXISTS `tbl_file_path_archive`;
CREATE TABLE `tbl_file_path_archive` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `job_id` bigint DEFAULT NULL,
  `app_uuid` varchar(64) DEFAULT NULL,
  `cache_path` varchar(1024) DEFAULT NULL COMMENT '文件的全路径',
  `cache_path_escaped` varchar(1024) DEFAULT NULL COMMENT '替换字符后的路径',
  `lib_path` varchar(1024) DEFAULT NULL COMMENT '存储路径',
  `volume_id` int DEFAULT NULL COMMENT '存储卷',
  `file_id` bigint DEFAULT NULL COMMENT '文件ID',
  `folder_id` bigint DEFAULT NULL COMMENT '文件存放目录，对应的目录ID',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `file_md5` char(32) DEFAULT NULL COMMENT '文件MD5码，暂时为空',
  `check_status` tinyint DEFAULT NULL COMMENT 'null，没有错误；-1，文件缺失；-2，大小不对；-3，MD5不对',
  `type` int DEFAULT 0 COMMENT '文件处理类型：0 文件，1 视频，2 目录，3 ZIP文件',
  `slot_id` int DEFAULT NULL COMMENT '光盘ID',
  PRIMARY KEY (`id`),
  KEY `idx_uuid` (`app_uuid`) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_file_path_restore for Restful API
-- ----------------------------
DROP TABLE IF EXISTS `tbl_file_path_restore`;
CREATE TABLE `tbl_file_path_restore` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `job_id` bigint DEFAULT NULL,
  `app_uuid` varchar(64) DEFAULT NULL,
  `cache_path` varchar(1024) DEFAULT NULL COMMENT '文件的全路径',
  `cache_path_escaped` varchar(1024) DEFAULT NULL COMMENT '替换字符后的路径',
  `volume_id` int DEFAULT NULL COMMENT '存储卷',
  `file_id` bigint DEFAULT NULL COMMENT '文件ID',
  `folder_id` bigint DEFAULT NULL COMMENT '文件存放目录，对应的目录ID',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `file_md5` char(32) DEFAULT NULL COMMENT '文件MD5码，暂时为空',
  `check_status` tinyint DEFAULT NULL COMMENT 'null，没有错误；-1，文件缺失；-2，大小不对；-3，MD5不对',
  `type` int DEFAULT 0 COMMENT '文件处理类型：0 文件，1 视频，2 目录，3 ZIP文件',
  `slot_id` int DEFAULT NULL COMMENT '光盘ID',
  PRIMARY KEY (`id`),
  KEY `idx_uuid` (`app_uuid`) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_lib_task`;
CREATE TABLE `tbl_lib_task` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_id` bigint NOT NULL COMMENT '刻录任务ID',
  `disc_id` int NOT NULL COMMENT 'disc id',
  `task_status` int NOT NULL COMMENT '任务状态：0 刻录，1 校验',
  `command` varchar(200) NOT NULL COMMENT '远程命令语句',
  `lib_id` int NOT NULL COMMENT '光盘库ID',
  `drive` int NOT NULL COMMENT '光驱序号',
  `start_dt` datetime DEFAULT NULL COMMENT '开始时间',
  `end_dt` datetime DEFAULT NULL COMMENT '结束时间',
  `cmt` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `index_task_id` (`task_id`) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_ft_sys for Restful API
-- ----------------------------
DROP TABLE IF EXISTS `tbl_ft_sys`;
CREATE TABLE `tbl_ft_sys` (
  `item_name` varchar(100) NOT NULL,
  `item_value` varchar(3000) DEFAULT NULL,
  `cmt` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`item_name`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_interface_task for Restful API
-- ----------------------------
DROP TABLE IF EXISTS `tbl_interface_task`;
CREATE TABLE `tbl_interface_task` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `create_time` datetime NOT NULL COMMENT '创建时间',
  `batch_id` varchar(100) DEFAULT NULL,
  `task_id` bigint DEFAULT NULL,
  `volume_id` varchar(200) DEFAULT NULL COMMENT '逻辑卷ID',
  `processing` tinyint DEFAULT NULL COMMENT 'null, 0，未处理， 1，正在处理或者已处理',
  `job_type` tinyint NOT NULL COMMENT '1是归档，2是恢复',
  `job_stage` tinyint DEFAULT NULL,
  `job_status` tinyint DEFAULT NULL COMMENT '状态的代码，用于快速筛选',
  `job_progress` tinyint DEFAULT NULL COMMENT '0~100 的任务进度',
  `cmt` varchar(100) DEFAULT NULL,
  `err_code` tinyint DEFAULT NULL,
  `err_str` varchar(1024) DEFAULT NULL,
  `buffer_id` int DEFAULT NULL COMMENT 'ftp用户和系统用户对应关系的id',
  `json_path` text DEFAULT NULL COMMENT '接口保存JSON',
  `json_type` tinyint DEFAULT 0 COMMENT '回迁方式，0 按文件回迁，1按目录回迁',
  `project_id_list` varchar(500) DEFAULT NULL COMMENT '接口任务对应的视频项目',
  PRIMARY KEY (`id`),
  KEY `idx_batch_id` (`batch_id`) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_sys_log for Restful API
-- ----------------------------
DROP TABLE IF EXISTS `tbl_sys_log`;
CREATE TABLE `tbl_sys_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `type` tinyint DEFAULT 0 COMMENT '日志级别 0:debug 1:info 2:warning 3:error',
  `operate_type` tinyint DEFAULT 0 COMMENT '1:设备,2:任务,4:用户,5:存储',
  `content` text COMMENT '显示内容', 
  `create_date` datetime DEFAULT NULL  COMMENT '创建时间',
  `user_id` int DEFAULT NULL  COMMENT '操作用户的id',
  `u_id` int DEFAULT NULL  COMMENT '被操作的用户id',
  `depa_id` int DEFAULT NULL  COMMENT '部门id',
  `ws_id` int DEFAULT NULL  COMMENT '工作区id',
  `r_id` int DEFAULT NULL  COMMENT '接收单id',
  `result` tinyint DEFAULT 0 COMMENT '结果返回1成功0失败',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备注',
  `ip` varchar(15) DEFAULT NULL COMMENT 'ip地址255.255.255.255',
  `is_delete` tinyint DEFAULT 0 COMMENT '0正常1删除',
  `lib_id` int DEFAULT NULL  COMMENT '设备id',
  `task_id` bigint DEFAULT NULL  COMMENT '任务id',
  `zip_file_id` bigint DEFAULT NULL  COMMENT '打包文件id',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- -----------------------------------------------------------------------------------------------------
-- Tables for video archive
-- -----------------------------------------------------------------------------------------------------

-- ----------------------------
-- Table structure for tbl_platform
-- ----------------------------
DROP TABLE IF EXISTS `tbl_platform`;
CREATE TABLE `tbl_platform` (
  `plat_id` int NOT NULL AUTO_INCREMENT COMMENT '平台ID',
  `type_id` int DEFAULT NULL COMMENT '平台类型ID',
  `plat_name` varchar(255) DEFAULT NULL COMMENT '平台名称',
  `IP` varchar(30) DEFAULT NULL COMMENT '平台IP',
  `port` varchar(10) DEFAULT NULL COMMENT '端口',
  `user_name` varchar(100) DEFAULT NULL COMMENT '用户',
  `pwd` varchar(100) DEFAULT NULL COMMENT '密码',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`plat_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='监控平台信息表';

-- ----------------------------
-- Table structure for tbl_platform_type
-- ----------------------------
DROP TABLE IF EXISTS `tbl_platform_type`;
CREATE TABLE `tbl_platform_type` (
  `type_id` int NOT NULL AUTO_INCREMENT COMMENT '类型ID',
  `type_name` varchar(255) DEFAULT NULL COMMENT '类型名称',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`type_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='监控平台类型表';

-- ----------------------------
-- Table structure for tbl_site
-- ----------------------------
DROP TABLE IF EXISTS `tbl_site`;
CREATE TABLE `tbl_site` (
  `site_id` int NOT NULL AUTO_INCREMENT COMMENT '主键（节点ID、房间ID）',
  `uuid` varchar(64) DEFAULT NULL COMMENT '监控点的uuid',
  `site_name` varchar(255) DEFAULT NULL COMMENT '名称（组名、房间名）',
  `s_level` int DEFAULT 0 COMMENT '相对于根节点的级别，根节点为0',
  `parent` int DEFAULT 0 COMMENT '上级节点ID，为0表示根节点',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`site_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='房间表（监控分组，由该表组成监视地点树结构）';

-- ----------------------------
-- Table structure for tbl_site_monitor
-- ----------------------------
DROP TABLE IF EXISTS `tbl_site_monitor`;
CREATE TABLE `tbl_site_monitor` (
  `monitor_id` int NOT NULL AUTO_INCREMENT COMMENT '设备ID',
  `monitor_name` varchar(255) DEFAULT NULL COMMENT '名称（可编辑名称）',
  `old_name` varchar(255) DEFAULT NULL COMMENT '平台发送的名称（不可编辑）',
  `uuid` varchar(50) NOT NULL COMMENT '唯一标识（IP、通道号）',
  `site_id` int DEFAULT NULL COMMENT '房间ID',
  `plat_id` int DEFAULT NULL COMMENT '平台ID',
  `used` tinyint DEFAULT 0 COMMENT '启用标识（0：未启用，1：启用）',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`monitor_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='房间对应监控设备';

-- ----------------------------
-- Table structure for tbl_site_monitor
-- ----------------------------
DROP TABLE IF EXISTS `tbl_platform_monitor`;
CREATE TABLE `tbl_platform_monitor` (
  `monitor_id` int NOT NULL AUTO_INCREMENT COMMENT '设备ID',
  `monitor_name` varchar(255) DEFAULT NULL COMMENT '平台发送的名称（不可编辑）',
  `uuid` varchar(50) NOT NULL COMMENT '唯一标识（IP、通道号）',
  `plat_id` int DEFAULT NULL COMMENT '平台ID',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`monitor_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='平台管理的所有监控设备getCamearaList';

-- ----------------------------
-- Table structure for tbl_task_monitor_files
-- ----------------------------
DROP TABLE IF EXISTS `tbl_project_monitor_files`;
CREATE TABLE `tbl_project_monitor_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_id` bigint DEFAULT NULL COMMENT 'tbl_task表ID，同一个项目可能有多个打印任务',
  `project_id` bigint NOT NULL COMMENT '任务ID',
  `monitor_id` int DEFAULT NULL COMMENT '监控设备ID或房间组ID',
  `file_name` varchar(255) DEFAULT NULL COMMENT '文件名',
  `file_size` bigint DEFAULT 0 COMMENT '文件大小',
  `archive_path` varchar(1024) DEFAULT NULL COMMENT '文件存储位置（相对缓冲区路径）',
  `duration` int DEFAULT NULL COMMENT '视频时长（单位:分钟）',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `progress` int DEFAULT 0 COMMENT '下载进度',
  `status` int DEFAULT 1 COMMENT '状态（0：可下载，1：下载完成，2：下载中，3：下载异常，4：按设定不下载，5：可合并视频，6：合并完成，7：合并中，8：合并异常，9：合并未满足条件）',
  `retry_times` int DEFAULT 0 COMMENT '重试次数',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`id`),
  KEY `index_monitor_id` (`monitor_id`) USING BTREE COMMENT '摄像头索引，用于加快联合查询速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='任务中每个设备对应的需下载的视频文件';

-- ----------------------------
-- Table structure for tbl_task_site
-- ----------------------------
DROP TABLE IF EXISTS `tbl_project_site`;
CREATE TABLE `tbl_project_site` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `project_id` bigint NOT NULL COMMENT '任务ID',
  `site_id` int NOT NULL COMMENT '房间ID',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='任务对应房间';

-- ----------------------------
-- Table structure for tbl_project
-- ----------------------------
DROP TABLE IF EXISTS `tbl_project`;
CREATE TABLE `tbl_project` (
  `project_id` bigint NOT NULL AUTO_INCREMENT,
  `maintitle` varchar(255) DEFAULT NULL COMMENT '主标题',
  `project_title` varchar(255) DEFAULT NULL COMMENT '项目名称',
  `subtitle` varchar(255) DEFAULT NULL COMMENT '项目副标题',
  `project_dt` datetime DEFAULT NULL COMMENT '项目时间',
  `volume_id` int NOT NULL COMMENT '逻辑卷编号',
  `status` int DEFAULT 1 COMMENT '状态（1：可下载，2：下载中，3：下载完成，4：归档中，0：归档完成（可自动出版），10:自动化出版待归档，12：自动化出版完成，21：下载异常，41：归档异常）',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  `project_num` varchar(500) DEFAULT NULL COMMENT '项目编号',
  PRIMARY KEY (`project_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='项目表';

-- ----------------------------
-- Table structure for tbl_task_projects
-- ----------------------------
DROP TABLE IF EXISTS `tbl_task_projects`;
CREATE TABLE `tbl_task_projects` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id` bigint NOT NULL COMMENT 'tbl_task表ID，1个任务可包含多个项目',
  `project_id` bigint NOT NULL COMMENT '项目ID',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='任务-项目关联表';


DROP TABLE IF EXISTS `tbl_disc_inspect`;
CREATE TABLE `tbl_disc_inspect`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `check_id` varchar(100) NOT NULL COMMENT '日期+顺序号：20200608-001',
  `disc_type` varchar(10) DEFAULT NULL COMMENT '光盘类型：BD/DVD/CD',
  `disc_mid` varchar(20) DEFAULT NULL COMMENT '光盘制造商编码',
  `disc_sn` varchar(100) DEFAULT NULL COMMENT '蓝光BCA码',
  `disc_vid` varchar(100) DEFAULT NULL COMMENT '光盘卷标',
  `inspect_type` tinyint DEFAULT NULL COMMENT '检测类型：初始检测0，期间检测1',
  `inspect_mode` tinyint DEFAULT NULL COMMENT '检测模式：全检 0，SPOT1 1，SPOT2 2',
  `inspect_start_time` datetime DEFAULT NULL COMMENT '检测开始时间',
  `inspect_stop_time` datetime DEFAULT NULL COMMENT '检测结束时间',
  `inspector` int DEFAULT 1 COMMENT '检测人',
  `rser` varchar(100) DEFAULT NULL COMMENT '蓝光光盘rser_max',
  `error` int DEFAULT NULL COMMENT '蓝光光盘be_max, DVD pie_max, CD bler_max',
  `ue` tinyint DEFAULT NULL COMMENT '不可纠正错误',
  `result_evaluation` varchar(100) DEFAULT NULL COMMENT '结果评价',
  `csv_path` varchar(1000) DEFAULT NULL COMMENT '光盘检测结果文件全路径',
  `cmt` varchar(500) DEFAULT '',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_backup_db`;
CREATE TABLE `tbl_backup_db` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'ID，应用端先生成任务ID，其他后续流程此ID为基准',
  `create_dt` datetime DEFAULT NULL COMMENT '备份日期',
  `backup_path` varchar(255) DEFAULT NULL COMMENT '备份文件全路径',
  `status` tinyint DEFAULT 0 COMMENT '备份状态，0表示正在备份，1表示备份成功，2表示备份失败，3表示备份文件已删除',
  `progress` tinyint DEFAULT NULL COMMENT '备份进度',
  `task_id` bigint DEFAULT NULL COMMENT '任务ID',
  `cmt` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- tbl_task_print
-- ----------------------------
DROP TABLE IF EXISTS `tbl_task_print`;
CREATE TABLE `tbl_task_print` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '光盘库逻辑卷下的父目录全路径',
  `task_id` bigint NOT NULL COMMENT '归档（或回迁）任务ID',
  `title` varchar(200) DEFAULT NULL COMMENT '主标题',
  `subtitle` varchar(200) DEFAULT NULL COMMENT '副标题',
  `disc_tip` varchar(200) DEFAULT NULL COMMENT '',
  `data_compare` tinyint DEFAULT 0 COMMENT '是否比较数据，0 不比较，1比较',
  `print_qrcode` tinyint DEFAULT 0 COMMENT '是否打印二维码，0 不打印二维码，1打印',
  `print_style` int DEFAULT NULL COMMENT '是否打印盘面及盘面样式，0不打印，>0打印的样式类型',
  `print_label` varchar(1000) DEFAULT NULL COMMENT '标签数据文件',
  `print_publisher` varchar(20) DEFAULT NULL COMMENT '发布机的名称',
  `print_copies` int DEFAULT 1 COMMENT '出版光盘数',
  `out_stacker` tinyint DEFAULT NULL COMMENT '出盘栈,取值：2、3、4',
  `in_stacker` tinyint DEFAULT NULL COMMENT '空盘栈，1:"1", 2:"2",0:"AUTO"（1和2）',
  `print_session` varchar(20) DEFAULT NULL COMMENT '实时刻录,取值："FIRST", "NEXT","END"',
  `cmt` varchar(200) DEFAULT NULL COMMENT '补充说明',
  `print_date` varchar(200) DEFAULT NULL COMMENT '日期',
  `print_img` varchar(1000) DEFAULT NULL COMMENT '背景图片地址',
  `publisher_type` tinyint DEFAULT 0 COMMENT '打印机类型，0 爱普生，1Rimage',
  `json_path` text COMMENT '扩展字段{number 自定义编号，qrcode 二维码内容}',
  PRIMARY KEY (`id`),
  KEY `index_task_id` (`task_id`) USING BTREE COMMENT '光盘表索引，用于加快联合查询速度'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- tbl_cd_cabinet
-- ----------------------------
DROP TABLE IF EXISTS `tbl_cd_cabinet`;
CREATE TABLE `tbl_cd_cabinet` (
  `cd_id` bigint NOT NULL COMMENT '光盘柜位置id',
  `disk_uuid` varchar(50) DEFAULT NULL COMMENT '光盘uuid',
  `cd_cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`cd_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- 多介质
-- ----------------------------
-- 用户角色关联表
DROP TABLE IF EXISTS `tbl_user_role`;
CREATE TABLE `tbl_user_role` (
  `user_id` bigint  COMMENT '用户id',
  `role_id` int COMMENT '角色id',
  PRIMARY KEY (`user_id`,`role_id`)
);

-- ----------------------------
-- 角色
DROP TABLE IF EXISTS `tbl_role`;
CREATE TABLE `tbl_role` (
  `role_id` int NOT NULL AUTO_INCREMENT COMMENT '角色id',
  `role_name` varchar(50) DEFAULT NULL COMMENT '角色名称',
  `role_type` int DEFAULT 0 COMMENT '角色类型，0普通,1预置(不允许修改)',
  `del_flag` int DEFAULT 0 COMMENT '删除',
  PRIMARY KEY (`role_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 角色对应权限
DROP TABLE IF EXISTS `tbl_role_fuc`;
CREATE TABLE `tbl_role_fuc` (
  `role_id` int NOT NULL COMMENT '角色id',
  `fun_id` int NOT NULL COMMENT '权限id',
  PRIMARY KEY (`role_id`,`fun_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 权限
DROP TABLE IF EXISTS `tbl_fuc`;
CREATE TABLE `tbl_fuc` (
  `fun_id` int NOT NULL COMMENT '权限id',
  `fun_name` varchar(50) DEFAULT NULL COMMENT '名称',
  `parent_id` int DEFAULT 0 COMMENT '父级id，显示时区分层级',
  `type` tinyint DEFAULT 0 COMMENT '类型0目录1模块',
  `fun_index` int DEFAULT 0 COMMENT '排序索引',
  PRIMARY KEY (`fun_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 系统信息
DROP TABLE IF EXISTS `tbl_sys`;
CREATE TABLE `tbl_sys` (
  `id` int NOT NULL COMMENT 'id',
  `name` varchar(50) DEFAULT NULL COMMENT '系统名称',
  `logo` varchar(255) DEFAULT NULL COMMENT '系统logo',
  `license` varchar(255) DEFAULT NULL COMMENT 'license文件',
  `license_info` varchar(255) DEFAULT NULL COMMENT 'license信息',
  `type` int DEFAULT 0 COMMENT '0系统设置',
  `db_back_time` int DEFAULT 0 COMMENT '数据库备份时间',
  `db_back_disk` int DEFAULT 0 COMMENT '数据库备份地址',
  `db_back_count` int DEFAULT 0 COMMENT '数据库备份数量',
  `del_back` int DEFAULT 0 COMMENT '回收站保留天数',
  `upload_opt` int DEFAULT 0 COMMENT '0未启用1启用',
  `en_name` varchar(255) DEFAULT NULL COMMENT '系统英文名称',
  `menu_type` int DEFAULT 0 COMMENT '0长保，1磁光电',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 部门表
DROP TABLE IF EXISTS `tbl_depa`;
CREATE TABLE `tbl_depa` (
  `depa_id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增部门ID',
  `depa_name` varchar(50) DEFAULT NULL COMMENT '部门名称',
  `depa_code` varchar(20) DEFAULT NULL COMMENT '部门编号',
  `alia_name` varchar(50) DEFAULT NULL COMMENT '别名',
  `depa_enable` tinyint DEFAULT 0 COMMENT '0:停用  1：启用',
  `min_optical` tinyint DEFAULT 0 COMMENT '刻录最长等待天数0不启用，大于0天数',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `base` tinyint DEFAULT 0 COMMENT '是否为标签样板0否1是',
  `del_flag` tinyint DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`depa_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 工作区
DROP TABLE IF EXISTS `tbl_workspace`;
CREATE TABLE `tbl_workspace` (
  `ws_id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增工作区ID',
  `depa_id` int DEFAULT NULL COMMENT '部门ID',
  `user_id`int DEFAULT NULL COMMENT '个人类型用户ID',
  `ws_name` varchar(50) DEFAULT NULL COMMENT '工作区名称',
  `alia_name` varchar(50) DEFAULT NULL COMMENT '工作区别名',
  `ws_enable` tinyint DEFAULT 1 COMMENT '0:停用  1：启用',
  `ws_type` tinyint DEFAULT 0 COMMENT '0:部门，1:个人，2:公共，3:归档盘',
  `ws_code` varchar(30) DEFAULT NULL COMMENT '工作区编号',
  `model_id` int DEFAULT NULL COMMENT '模板ID',
  `tac_id` int DEFAULT NULL COMMENT '策略ID',
  `min_optical` tinyint DEFAULT 0 COMMENT '刻录最长等待天数0不启用，大于0天数',
  `last_optical` tinyint DEFAULT 0 COMMENT '上次刻录时间',
  `disk_sn` int DEFAULT NULL COMMENT '托管硬盘的sn号',
  PRIMARY KEY (`ws_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 部门卷关联表
DROP TABLE IF EXISTS `tbl_volume_depa`;
CREATE TABLE `tbl_volume_depa` (
  `volume_id` int NOT NULL COMMENT '逻辑卷编号',
  `depa_id` int NOT NULL COMMENT '部门编号',
  `permission` int DEFAULT NULL COMMENT '0：可读，1：可读可写 ',
  `current_vol` tinyint DEFAULT 0 COMMENT '1表示接口部门当前使用的卷',
  PRIMARY KEY (`volume_id`,`depa_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 工作区卷关联表
DROP TABLE IF EXISTS `tbl_volume_workspace`;
CREATE TABLE `tbl_volume_workspace` (
  `volume_id` int NOT NULL COMMENT '逻辑卷编号',
  `depa_id` int NOT NULL COMMENT '部门编号',
  `back_index` int DEFAULT 0 COMMENT '0：原始卷 非0副本卷',
  `ws_id` tinyint DEFAULT 0 COMMENT '工作区编号',
  PRIMARY KEY (`volume_id`,`depa_id`,`ws_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 部门用户关联表
DROP TABLE IF EXISTS `tbl_depa_user`;
CREATE TABLE `tbl_depa_user` (
  `depa_id` int NOT NULL COMMENT '部门编号',
  `user_id` int NOT NULL COMMENT '用户编号',
  `black_list` varchar(255) DEFAULT NULL COMMENT '工作区黑名单',
  `white_list` varchar(255) DEFAULT NULL COMMENT '工作区白名单',
  PRIMARY KEY (`depa_id`,`user_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 部门用户权限表
DROP TABLE IF EXISTS `tbl_depa_user_info`;
CREATE TABLE `tbl_depa_user_info` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增部门用户权限ID',
  `depa_id` int NOT NULL COMMENT '部门编号',
  `user_id` int NOT NULL COMMENT '用户编号',
  `fuc_id` int DEFAULT NULL COMMENT '权限id',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `del_status` tinyint DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;


-- 介质登记管理表
DROP TABLE IF EXISTS `tbl_register_management`;
CREATE TABLE `tbl_register_management` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '登记管理ID',
  `create_date` datetime DEFAULT NULL COMMENT '登记日期',
  `update_date` datetime DEFAULT NULL COMMENT '更新日期',
  `slot_type` tinyint DEFAULT 0 COMMENT '介质类型 0 光盘， 1 磁带， 2 硬盘， 3 胶片',
  `slot_num` varchar(30) DEFAULT NULL COMMENT '介质编号',
  `slot_info` varchar(200) DEFAULT NULL COMMENT '备份载体信息',
  `slot_position` varchar(200) DEFAULT NULL COMMENT '位置信息',
  `slot_status` tinyint DEFAULT 0 COMMENT '介质状态0新增1借出2归还3检测',
  `recall` varchar(200) DEFAULT NULL COMMENT '催还',
  `lend` varchar(200) DEFAULT NULL COMMENT '借出',
  `detection` varchar(200) DEFAULT NULL COMMENT '检测',
  `person_record` varchar(200) DEFAULT NULL COMMENT '人员记录',
  `cmt` varchar(200) DEFAULT NULL COMMENT '信息备注',
  `is_delete` tinyint DEFAULT 0 COMMENT '是否删除 0 否 1 是',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 备份窗口表（排除时间）
DROP TABLE IF EXISTS `tbl_back_window`;
CREATE TABLE `tbl_back_window` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '主键 id',
  `wday` int NOT NULL COMMENT '星期0-6;星期日=0',
  `start_time` bigint DEFAULT NULL COMMENT '开始排除时间，从0点开始的秒数',
  `end_time` bigint DEFAULT NULL COMMENT '结束排除时间，从0点开始的秒数',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='备份窗口表';

-- 介质管理流程表
DROP TABLE IF EXISTS `tbl_hd_manager`;
CREATE TABLE `tbl_hd_manager` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `serial_num` varchar(50) NOT NULL COMMENT '硬盘序列号',
  `process` int NOT NULL COMMENT '1加电，2下电，3挂载，4卸载，5加入，6取出等操作',
  `process_dt` datetime NOT NULL COMMENT '操作时间',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_diskfile_check
-- ----------------------------
DROP TABLE IF EXISTS `tbl_diskfile_check`;
CREATE TABLE `tbl_diskfile_check` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `task_id` int DEFAULT NULL COMMENT '校验任务ID',
  `volume_id` int NOT NULL COMMENT '光盘卷ID',
  `file_path` varchar(1024) DEFAULT NULL COMMENT '校验错误文件全路径',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
-- ----------------------------
-- Table structure for tbl_receipt
-- ----------------------------
DROP TABLE IF EXISTS `tbl_receipt`;
CREATE TABLE `tbl_receipt` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `annual` varchar(50) DEFAULT NULL COMMENT '年度',
  `batch` varchar(50) DEFAULT NULL COMMENT '批次',
  `receive_num` varchar(50) DEFAULT NULL COMMENT '接收号',
  `transfer_unit` varchar(50) DEFAULT NULL COMMENT '移交单位',
  `transferer` varchar(20) DEFAULT NULL COMMENT '移交人',
  `transfer_date` datetime DEFAULT NULL COMMENT '移交时间',
  `receive_unit` varchar(50) DEFAULT NULL COMMENT '接收单位',
  `receiver` varchar(20) DEFAULT NULL COMMENT '接收人',
  `files_count` int DEFAULT NULL COMMENT '案卷数',
  `nums` int DEFAULT NULL COMMENT '份数',
  `remark` varchar(200) DEFAULT NULL COMMENT '附注',
  `status` tinyint DEFAULT NULL COMMENT '接收单状态待审核：1,已入库：0,审核成功：2,审核失败：3,接收文件成功：4,四性检测成功：5,四性检测失败：10,元数据关联成功：6,元数据关联失败：20,四性检测中:7,入库磁存储：8，入库失败：11，删除 -1',
  `update_dt` datetime DEFAULT NULL COMMENT '更新时间',
  `create_dt` datetime DEFAULT NULL COMMENT '创建时间',
  `volume_id` int DEFAULT 0 COMMENT '卷ID',
  `file_path` varchar(1024) DEFAULT NULL COMMENT '档案包文件路径',
  `ws_id` bigint DEFAULT NULL COMMENT '存储工作区',
  `type` int DEFAULT 0,
  `archive_type` varchar(200) DEFAULT NULL COMMENT '接收单档案类型',
  `template_type` varchar(200) DEFAULT NULL COMMENT '接收单模版类型',
  `check_type` bigint DEFAULT NULL COMMENT '四性检测模版类型',
  `check_params` varchar(500) DEFAULT NULL COMMENT '四性检测选择项',
  `scan_task_id` bigint DEFAULT NULL COMMENT '扫描任务ID',
  `import_method` int DEFAULT 0 COMMENT '导入方式，0 普通流程，1 批量流程',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_receipt_file
-- ----------------------------
DROP TABLE IF EXISTS `tbl_receipt_file`;
CREATE TABLE `tbl_receipt_file` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `file_name` varchar(765) DEFAULT NULL COMMENT '文件名(带后缀)',
  `file_size` bigint DEFAULT NULL COMMENT '大小',
  `hash` varchar(65) DEFAULT NULL COMMENT 'md5',
  `r_id` bigint NOT NULL COMMENT '接收单id',
  `create_date` datetime DEFAULT NULL COMMENT '文件原始创建时间',
  `status` tinyint DEFAULT 0 COMMENT '文件检测状态0待检测1检测通过2检测中3检测失败',
  `path` varchar(1024) DEFAULT NULL COMMENT '检测文件zip所在路径',
  `check_id` varchar(64) DEFAULT NULL COMMENT '检测任务ID',
  `cmt` varchar(765) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
-- ----------------------------
-- Table structure for tbl_receipt_check
-- ----------------------------
DROP TABLE IF EXISTS `tbl_receipt_check`;
CREATE TABLE `tbl_receipt_check` (
  `r_file_id` int NOT NULL COMMENT '接收单关联的文件编号',
  `check_id` varchar(64) NOT NULL COMMENT '检测任务编号',
  `result` int DEFAULT NULL COMMENT '检测结果：0检测中1检测成功2检测失败',
  PRIMARY KEY (`r_file_id`,`check_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
-- ----------------------------
-- Table structure for tbl_meta_data
-- ----------------------------
DROP TABLE IF EXISTS `tbl_meta_data`;
CREATE TABLE `tbl_meta_data` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `type` tinyint DEFAULT 0 COMMENT '档案类型:文书类:0,基建类:1,会计类:2,科研类:3,设备仪器:4,音像类:5,实物:6,业务:7,科技:8',
  `mode` tinyint DEFAULT 0 COMMENT '文件级:0案卷级:1',
  `dh` varchar(50) DEFAULT NULL COMMENT '档号',
  `qzh` varchar(4) DEFAULT NULL COMMENT '全宗号',
  `nd` varchar(4) DEFAULT NULL COMMENT '年度',
  `mlh` varchar(3) DEFAULT NULL COMMENT '目录号',
  `flh` varchar(80) DEFAULT NULL COMMENT '分类号',
  `ajh` varchar(6) DEFAULT NULL COMMENT '案卷号',
  `zyh` varchar(6) DEFAULT NULL COMMENT '页号',
  `tm` varchar(254) DEFAULT NULL COMMENT '题名',
  `qzmc` varchar(100) DEFAULT NULL COMMENT '全宗名称',
  `zrz` varchar(80) DEFAULT NULL COMMENT '责任者',
  `wjbh` varchar(50) DEFAULT NULL COMMENT '文件编号',
  `xcsj` varchar(10) DEFAULT NULL COMMENT '文件形成时间[20220108]',
  `bgqx` tinyint DEFAULT 0 COMMENT '保管期限:永久0、长期1，短期2、30年3、10年4',
  `mj` tinyint DEFAULT 0 COMMENT '密级:公开0、国内1、内部2、秘密3、机密4、绝密6',
  `hh` varchar(4) DEFAULT NULL COMMENT '盒号',
  `extra_meta` text DEFAULT NULL COMMENT '其他元数据信息json',
  `rfid` bigint DEFAULT NULL COMMENT '对应的档案包文件id',
  `cmt` varchar(765) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- ----------------------------
-- Table structure for tbl_task_receipts
-- ----------------------------
DROP TABLE IF EXISTS `tbl_task_receipts`;
CREATE TABLE `tbl_task_receipts` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id` bigint NOT NULL COMMENT 'tbl_task表ID，1个任务1个接收单',
  `r_id` bigint NOT NULL COMMENT '接收单ID',
  `cmt` varchar(500) DEFAULT NULL COMMENT '描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='任务-接收单关联表';
-- ----------------------------
-- Table structure for tbl_receipt_file_detail
-- ----------------------------
DROP TABLE IF EXISTS `tbl_receipt_file_detail`;
CREATE TABLE `tbl_receipt_file_detail` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID（数字型）',
  `receipt_file_id` bigint NOT NULL  COMMENT '接收单文件id',
  `file_name` varchar(765) DEFAULT NULL COMMENT '文件名称',
  `path` varchar(765) DEFAULT NULL COMMENT '文件相对路径',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `hash` varchar(65) DEFAULT NULL COMMENT '文件校验码',
  `create_date` datetime DEFAULT NULL COMMENT '文件原始创建时间，非归档时间',
  `status` tinyint DEFAULT '1' COMMENT '文件状态 1普通文件 2档案文件',
  `is_folder` tinyint DEFAULT NULL COMMENT '是否文件夹0文件1文件夹',
  PRIMARY KEY (`id`),
  KEY `index_recepit_file_id` (`receipt_file_id`) USING BTREE COMMENT '索引'
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 档案类型
DROP TABLE IF EXISTS `tbl_archives_type`;
CREATE TABLE `tbl_archives_type` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `type_name` varchar(50) DEFAULT NULL COMMENT '档案类型',
  `s_level` tinyint DEFAULT NULL COMMENT '层级结构',
  `cmt` varchar(765) DEFAULT NULL COMMENT '备注',
  `is_delete` tinyint DEFAULT 0 COMMENT '是否删除0未删除1删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='档案类型表';

-- 档案层级
DROP TABLE IF EXISTS `tbl_archives_level`;
CREATE TABLE `tbl_archives_level` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `name` varchar(50) DEFAULT NULL COMMENT '层级名称',
  `type_id` bigint DEFAULT 0 COMMENT '档案类型id',
  `s_level` tinyint DEFAULT 0 COMMENT '层级',
  `level_type` tinyint DEFAULT 0 COMMENT '文件级0案卷级1原文级2',
  `model` varchar(50) DEFAULT NULL COMMENT '绑定模版文件名称',
  `cmt` varchar(765) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='档案类型层级表';

-- 导出外部介质记录表
DROP TABLE IF EXISTS `tbl_export_info`;
CREATE TABLE `tbl_export_info` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `zip_file_id` bigint DEFAULT NULL COMMENT '包id',
  `from_path` varchar(1024) DEFAULT NULL COMMENT '源路径',
  `to_path` varchar(1024) DEFAULT NULL COMMENT '目的路径',
  `create_dt` datetime DEFAULT NULL COMMENT '创建时间',
  `update_dt` datetime DEFAULT NULL COMMENT '更新时间',
  `media_type` tinyint DEFAULT 0 COMMENT '导出所在介质类型 u盘0硬盘1光盘2',
  `name` varchar(100) DEFAULT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `hash` varchar(65) DEFAULT NULL COMMENT '文件校验码',
  `status` tinyint DEFAULT 0 COMMENT '导出状态 0 完成, 1 未导出, 2 导出中, 3 异常',
  `progress` tinyint DEFAULT NULL COMMENT '导出进度',
  `cmt` varchar(765) DEFAULT NULL COMMENT '备注',
  `user_id` int DEFAULT NULL COMMENT '导出的用户id',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='导出外部介质记录表';

-- 文件恢复记录表
DROP TABLE IF EXISTS `tbl_file_recover_info`;
CREATE TABLE `tbl_file_recover_info` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `pre_file_id` bigint DEFAULT 0 COMMENT '之前的文件id',
  `pre_folder_id` bigint DEFAULT 0 COMMENT '之前的目的路径',
  `pre_volume_id` tinyint DEFAULT 0 COMMENT '之前所在卷',
  `task_id` bigint DEFAULT NULL COMMENT '恢复任务id',
  `create_dt` datetime DEFAULT NULL COMMENT '创建时间',
  `name` varchar(100) DEFAULT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `hash` varchar(65) DEFAULT NULL COMMENT '文件校验码',
  `cmt` varchar(765) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='文件恢复记录表';

-- 库房环境表
DROP TABLE IF EXISTS `tbl_sys_env`;
CREATE TABLE `tbl_sys_env` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `lib_id` int DEFAULT NULL COMMENT '相关设备',
  `temperature` varchar(10) DEFAULT NULL COMMENT '温度',
  `humidity` varchar(10) DEFAULT NULL COMMENT '湿度',
  `co2` varchar(10) DEFAULT NULL COMMENT '二氧化碳',
  `tvoc` varchar(10) DEFAULT NULL COMMENT 'tvoc',
  `pm10` varchar(10) DEFAULT NULL COMMENT 'pm10',
  `pm2` varchar(10) DEFAULT NULL COMMENT 'pm2.5',
  `create_dt` datetime DEFAULT NULL COMMENT '创建时间',
  `cmt` varchar(765) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='库房环境表';

-- 胶片库操作记录表
DROP TABLE IF EXISTS `tbl_film_operat`;
CREATE TABLE `tbl_film_operat` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `lib_id` int DEFAULT NULL COMMENT '相关设备',
  `uuid` varchar(50) DEFAULT NULL COMMENT '胶片uuid',
  `name` varchar(50) DEFAULT NULL COMMENT '胶片名称',
  `type` tinyint DEFAULT 0 COMMENT '操作类型',
  `time` datetime DEFAULT NULL COMMENT '时间',
  `cmt` varchar(765) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT='胶片库操作记录表';

-- 电子档案检测环节表，主要存储档案管理的环节及相关说明
DROP TABLE IF EXISTS `tbl_check_sector`;
CREATE TABLE `tbl_check_sector`(
  `id` VARCHAR(64) NOT NULL COMMENT 'id',
  `sector` VARCHAR(16)  NOT NULL COMMENT '档案管理环节：archiving 归档环节、transfer 移交与接收环节、archival 长期保存环节',
  `sector_name` VARCHAR(50)  NOT NULL COMMENT '档案管理环节名称: archiving 归档环节、transfer 移交与接收环节、archival 长期保存环节',
  `sector_description` VARCHAR(1000)  NULL COMMENT '档案管理环节说明及相关参考',
  `sector_order` VARCHAR(10)  NOT NULL DEFAULT '1' COMMENT '档案管理环节排序',
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',  
  `del_status` TINYINT(4) NULL DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '电子档案检测环节表，主要存储档案管理的环节及相关说明（只修改名称、说明和排序）';

-- 电子档案检测模板表
DROP TABLE IF EXISTS `tbl_check_template`;
CREATE TABLE `tbl_check_template`(
  `id` VARCHAR(64) NOT NULL COMMENT 'id',
  `template_type` VARCHAR(16)  NULL COMMENT '模板类型: standard 标准，custom 自定义模板',
  `template_name` VARCHAR(250)  NULL COMMENT '检测模板名称，通常指定档案类型',
  `template_description` VARCHAR(250)  NULL COMMENT '检测模板说明',
  `template_order` VARCHAR(10)  NULL COMMENT '检测模板排序',
  `before_file` VARCHAR(200)  NULL COMMENT '四性检测的预处理js文件',
  `before_method` VARCHAR(200)  NULL COMMENT '四性检测的预处理js方法',
  `after_file` VARCHAR(200)  NULL COMMENT '四性检测的结束处理js文件',
  `after_method` VARCHAR(200)  NULL COMMENT '四性检测的结束处理js方法',
  `locked` TINYINT(4) NULL DEFAULT 0 COMMENT '是否可用  0:未锁定  1:锁定；锁定状态状态不可编辑，锁定后才可用于四性检测，未锁定状态可编辑，但不可用于四性检测。',
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',  
  `del_status` TINYINT(4) NULL DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '电子档案检测模板表，主要存储电子档案四性检测的模板及相关说明，系统内只可以修改名称、说明，排序，其它均系统内置，不可删除，可以复制';

-- 电子档案检测类别表
DROP TABLE IF EXISTS `tbl_check_category`;
CREATE TABLE `tbl_check_category`(
  `id` VARCHAR(64) NOT NULL COMMENT 'id',
  `category` VARCHAR(16)  NOT NULL COMMENT '检测类别: authenticity 真实性，integrity 完整性，usability 可用性，security 安全性',
  `category_name` VARCHAR(50)  NOT NULL COMMENT '检测类别名称: 真实性，完整性，可用性，安全性',
  `category_description` VARCHAR(250)  NOT NULL COMMENT '检测类别说明及相关参考',
  `category_order` VARCHAR(10)  NOT NULL COMMENT '检测类别排序',  
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',  
  `del_status` TINYINT(4) NULL DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '电子档案检测类别表，主要存储电子档案四性检测的类别及相关说明(不允许删除，只能修改名称、说明、排序)';

-- 电子档案检测子类别表
DROP TABLE IF EXISTS `tbl_check_sub_category`;
CREATE TABLE `tbl_check_sub_category`(
  `id` VARCHAR(64) NOT NULL COMMENT 'id',
  `template_id` VARCHAR(64)  NOT NULL COMMENT '模板id',
  `sector` VARCHAR(16)  NOT NULL COMMENT '档案管理环节：archiving 归档环节、transfer 移交与接收环节、archival 长期保存环节',
  `category` VARCHAR(16)  NOT NULL COMMENT '检测类别: authenticity 真实性，integrity 完整性，usability 可用性，security 安全性',  
  `sub_category` VARCHAR(16)  NOT NULL COMMENT '检测子类别',
  `sub_category_order` VARCHAR(10)  NOT NULL COMMENT '检测子类别排序',
  `disabled` TINYINT(4) NULL DEFAULT 0 COMMENT '是否禁用  0:可用  1:禁用；',
  `sub_category_description` VARCHAR(500)  NOT NULL COMMENT '检测类别说明及相关参考',
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',  
  `del_status` TINYINT(4) NULL DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '电子档案检测类别表，主要存储电子档案四性检测的类别及相关说明';

-- 四性检测检测项目表
DROP TABLE IF EXISTS `tbl_check_item`;
CREATE TABLE `tbl_check_item`(
  `id` VARCHAR(64) COMMENT 'id',
  `template_id` VARCHAR(64)  NOT NULL COMMENT '模板id',  
  `sector` VARCHAR(16)  NOT NULL COMMENT '档案管理环节：archiving 归档环节、transfer 移交与接收环节、archival 长期保存环节',
  `category` VARCHAR(16)  NOT NULL COMMENT '检测类别: authenticity 真实性，integrity 完整性，usability 可用性，security 安全性',  
  `sub_category` VARCHAR(64)  NOT NULL COMMENT '检测子类别',
  `check_type` VARCHAR(16)  NOT NULL COMMENT '检测方式：standard 标准（可程序自动检测），manual 人工检测',  
  `item_code` VARCHAR(16)  NOT NULL COMMENT '检测项目编号',
  `item_name` VARCHAR(100)  NOT NULL COMMENT '检测项目名称',
  `item_purpose` VARCHAR(200)  NOT NULL COMMENT '检测目的',
  `item_object` VARCHAR(64)  NOT NULL COMMENT '检测对象',
  `item_order` VARCHAR(20)  NOT NULL COMMENT '检测项目排序,建议使用【管理环节排序】 + 【类别排序】 + 【子类别排序】 + 当前排序，每个排序使用长度4的数字编号',
  `item_description` VARCHAR(250)  NOT NULL COMMENT '检测项目描述，依据',
  `disabled` TINYINT(4) NULL DEFAULT 0 COMMENT '是否禁用  0:可用  1:禁用；',
  `checked`  TINYINT(4) NULL DEFAULT 1 COMMENT '默认检查  0:不检查  1:检查(勾选)',  
  `handle_file` VARCHAR(200)  NULL COMMENT '四性检测的js文件',
  `handle_method` VARCHAR(200)  NULL COMMENT '四性检测的js方法',
  `passed` TINYINT(4) NULL COMMENT '如果是人工检测，需要使用此字段  0:检测未通过  1:检测通过',  
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',  
  `del_status` TINYINT(4) NULL DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '四性检测检测项目表';

-- 四性检测检测任务表
DROP TABLE IF EXISTS `tbl_check_task`;
CREATE TABLE `tbl_check_task`(
  `id` VARCHAR(64) COMMENT 'id',
  `template_id` VARCHAR(64)  NOT NULL COMMENT '模板id',  
  `sector` VARCHAR(16)  NOT NULL COMMENT '档案管理环节：archiving 归档环节、transfer 移交与接收环节、archival 长期保存环节',
  `title` VARCHAR(50)  NOT NULL COMMENT '检测名称',
  `description` VARCHAR(200)  COMMENT '检测描述',
  `params` VARCHAR(2000)  COMMENT '检测参数',
  `before_file_id` VARCHAR(200)  NULL COMMENT '四性检测的预处理js文件id',
  `before_file` VARCHAR(200)  NULL COMMENT '四性检测的预处理js文件',
  `before_method` VARCHAR(200)  NULL COMMENT '四性检测的预处理js方法',
  `after_file_id` VARCHAR(200)  NULL COMMENT '四性检测的结束处理js文件id',
  `after_file` VARCHAR(200)  NULL COMMENT '四性检测的结束处理js文件',
  `after_method` VARCHAR(200)  NULL COMMENT '四性检测的结束处理js方法',
  `package` VARCHAR(1000)  NULL COMMENT '四性检测的档案信息包',
  `package_md5` VARCHAR(64)  NULL COMMENT '四性检测的档案信息包md5值',
  `status` TINYINT(4) NULL DEFAULT 2 COMMENT '检测状态： 0 检测通过；1 检测未通过；2 待提交；3 已提交；4 处理中；5 终止',  
  `commit_time` datetime NULL COMMENT '提交时间',
  `finish_time` datetime NULL COMMENT '完成时间',
  `create_time` datetime NULL COMMENT '创建时间',  
  `update_time` datetime NULL COMMENT '更新时间',  
  `del_status` TINYINT(4) NULL DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '四性检测检测任务表';

-- 四性检测检测任务细目表
DROP TABLE IF EXISTS `tbl_check_task_item`;
CREATE TABLE `tbl_check_task_item`(
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `task_id` VARCHAR(64)  NOT NULL COMMENT '四性检测任务id',  
  `check_item_id` VARCHAR(64)  NOT NULL COMMENT '四性检测项id',  
  `file_id`  VARCHAR(200)   COMMENT '检测任务如果成功，就将检测所使用的文件保存起来，并记录文件id',  
  `handle_file` VARCHAR(200)  NULL COMMENT '四性检测的js文件',
  `handle_method` VARCHAR(200)  NULL COMMENT '四性检测的js方法',
  `passed` TINYINT(4) NULL COMMENT '如果是人工检测，需要使用此字段  0:检测通过  1:检测未通过',    
  `status` TINYINT(4) NULL DEFAULT 2 COMMENT '检测状态： 0 检测通过；1 检测未通过；2 待提交；3 已提交；4 处理中；5 终止',  
  `remarks` VARCHAR(200)  NULL DEFAULT NULL COMMENT '检测信息',  
  `commit_time` datetime NULL COMMENT '提交时间',
  `finish_time` datetime NULL COMMENT '完成时间',
  `create_time` datetime NULL COMMENT '创建时间',  
  `update_time` datetime NULL COMMENT '更新时间',  
  `del_status` TINYINT(4) NULL DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  KEY `index_task_id` (`task_id`) USING BTREE,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '四性检测检测任务细目表';

-- 四性检测检测所使用的检测文件
DROP TABLE IF EXISTS `tbl_check_files`;
CREATE TABLE `tbl_check_files`(
  `id` VARCHAR(64) COMMENT '四性检测时使用的程序文件ID(文件md5值)',
  `file_name` VARCHAR(200)  COMMENT '保存文件时的文件名称',  
  `file_path` VARCHAR(500)  COMMENT '保存文件时的文件路径',  
  `file_content` LONGBLOB  COMMENT '文件的二进制内容',
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '四性检测检测任务所使用的检测文件';

-- 四性检测检测任务实际使用的检测文件
DROP TABLE IF EXISTS `tbl_check_task_file`;
CREATE TABLE `tbl_check_task_file`(
  `task_id` VARCHAR(64) COMMENT '检测任务id',
  `task_item_id` VARCHAR(64)  COMMENT '四性检测任务项id',
  `check_item_id` VARCHAR(64)  NOT NULL COMMENT '四性检测项id',
  `file_id` VARCHAR(64)  COMMENT '四性检测时使用的程序文件ID(文件md5值)',
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',
  PRIMARY KEY (`task_id`, `task_item_id`, `check_item_id`, `file_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '四性检测检测任务所使用的检测文件';

-- 四性检测检测过程信息记录表
DROP TABLE IF EXISTS `tbl_check_log`;
CREATE TABLE `tbl_check_log`(
  `id` VARCHAR(64) COMMENT '主键,无意义，UUID',
  `task_id` VARCHAR(64)  NOT NULL COMMENT '四性检测任务id',
  `task_item_id` VARCHAR(64)  COMMENT '四性检测任务项id',
  `check_item_id` VARCHAR(64)  NOT NULL COMMENT '四性检测项id',
  `info_type`  VARCHAR(10)   COMMENT '日志消息类别: DEBUG 调试消息, INFO 正常消息, WARN 警告消息, ERROR 错误消息',
  `check_file` VARCHAR(100)  NULL COMMENT '检测的程序文件名',
  `check_function` VARCHAR(100)  NULL COMMENT '检测的方法名',
  `message` VARCHAR(1000)  NULL COMMENT '检测过程消息',
  `create_time` datetime NULL COMMENT '创建时间',
  KEY `index_task_id` (`task_id`) USING BTREE,
  KEY `index_task_item_id` (`task_item_id`) USING BTREE,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '四性检测检测过程信息记录表';

-- 长期保存巡检策略
DROP TABLE IF EXISTS `tbl_check_patrol_strategy`;
CREATE TABLE `tbl_check_patrol_strategy`(
  `id` VARCHAR(64) NOT NULL COMMENT 'id',
  `strategy_name` VARCHAR(250)  NOT NULL COMMENT '巡检策略名称',
  `strategy_description` VARCHAR(250)  NOT NULL COMMENT '描述',
  `condition_params` VARCHAR(1000)  NOT NULL COMMENT '巡检条件参数，JSON 结构字符串。例：[{"key":"quanzong","name":"全宗号","value":["Z001","Z002","Z003"]},{"key":"year","name":"年度","value":["1998","2017","2022"]}]',
  `check_item` VARCHAR(250)  NOT NULL COMMENT '检测项，包括：online 在线检测, medium 旧介质检测, offmedium 新介质检测',
  `cron` varchar(200)  DEFAULT NULL COMMENT 'cron表达式，巡检时间：0 立即，1 定时',
  `template_id` VARCHAR(250)  NOT NULL COMMENT '四性检测模板id',
  `enable` TINYINT(4) NULL DEFAULT 0 COMMENT '是否启用  0:停用  1:启用',
  `effective_date` datetime NULL COMMENT '生效时间',
  `terminated_date` datetime DEFAULT NULL COMMENT '失效时间，为空表示长期有效',
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',
  `del_status` TINYINT(4) NULL DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  `user_id` int DEFAULT 1  COMMENT '创建用户的id',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '长期保存巡检策略表，主要存储巡检策略，可以修改、禁用，删除前需要判断是否创建了检查巡检任务，只可删除没有关联任务的策略';

-- 长期保存巡检任务表
DROP TABLE IF EXISTS `tbl_check_patrol_task`;
CREATE TABLE `tbl_check_patrol_task`(
  `id` VARCHAR(64) NOT NULL COMMENT 'id',
  `strategy_id` VARCHAR(64) NOT NULL COMMENT '巡检策略id，即当前巡检任务是根据哪个巡检策略生成的',
  `template_id` VARCHAR(250)  NOT NULL COMMENT '四性检测模板id',
  `name` VARCHAR(250)  NOT NULL COMMENT '巡检任务名称，通常默认取策略名称+当前日期',
  `description` VARCHAR(250)  NULL COMMENT '巡检任务描述',
  `condition_params` VARCHAR(500)  NOT NULL COMMENT '巡检条件参数，JSON 结构字符串。例：[{"key":"quanzong","name":"全宗号","value":["Z001","Z002","Z003"]},{"key":"year","name":"年度","value":["1998","2017","2022"]}]',
  `check_item` VARCHAR(250)  NOT NULL COMMENT '检测项，包括：amount 数量，check_code 校验码，medium 介质检测，four_properties 四性检测。多个项用英文逗号分隔',
  `status` VARCHAR(20) NULL DEFAULT NULL COMMENT '任务状态  SUCCESS:成功  FAIL:失败  NODATA：没有添加档案包数据  WAIT：等待提交  COMMIT: 已提交  PROCESSING：处理中  ABORT：中止',
  `message` VARCHAR(1000) NULL COMMENT '错误信息描述',
  `archive_count` INT NULL DEFAULT 0 COMMENT '检测档案数量',
  `package_count` INT NULL DEFAULT 0 COMMENT '检测档案包数量',
  `success_count` INT NULL DEFAULT 0 COMMENT '通过检测数量',
  `fail_count` INT NULL DEFAULT 0 COMMENT '未通过检测数量',
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',
  `start_time` datetime DEFAULT NULL COMMENT '任务开始时间',
  `finished_time` datetime DEFAULT NULL COMMENT '任务完成时间',
  `medium_task_id` bigint DEFAULT NULL COMMENT 'tbl_task表ID，1个介质巡检任务对应1个巡检任务',
  `del_status` TINYINT(4) NULL DEFAULT 0 COMMENT '删除标志  0:正常  1:已删除',
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '长期保存巡检任务表，可以修改任务名称、不可删除已提交巡检任务';

-- 巡检包记录表
DROP TABLE IF EXISTS `tbl_inspect_zip`;
CREATE TABLE `tbl_inspect_zip` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id` bigint DEFAULT NULL COMMENT '任务ID（tbl_task.id）',
  `inspect_method` int DEFAULT NULL COMMENT '巡检方式 1 数据包检测 2 包内文件检测 3 综合检测',
  `slot_id` bigint DEFAULT NULL COMMENT '介质 slot_id',
  `zip_id` bigint DEFAULT NULL COMMENT 'tbl_zip_file.id',
  `file_id` bigint DEFAULT NULL COMMENT '逻辑卷文件表 tbl_file_{volume_id}_a.id',
  `file_name` varchar(765) DEFAULT NULL COMMENT 'ISO包名称',
  `file_size` bigint DEFAULT NULL COMMENT 'ISO包大小',
  `file_count` bigint DEFAULT NULL COMMENT '包内文件数量',
  `volume_id` int DEFAULT NULL COMMENT '该包在离线接收/封包任务的 volume_id',
  `hash` varchar(65) DEFAULT NULL COMMENT '离线接收时 ISO 包 hash',
  `hash1` varchar(65) DEFAULT NULL COMMENT '巡检时 ISO 包 hash',
  `csv_hash` varchar(65) DEFAULT NULL COMMENT '离线接收时 fileInfo.csv 原始 hash',
  `csv_hash1` varchar(65) DEFAULT NULL COMMENT '巡检时 fileInfo.csv hash',
  `create_dt` datetime DEFAULT NULL COMMENT '创建时间',
  `update_dt` datetime DEFAULT NULL COMMENT '更新时间',
  `stage` tinyint DEFAULT 0 COMMENT '校验流程阶段：0未开始；1包ISO校验中；2包校验完成；3包内文件校验中；4包内文件校验完成',
  `status` tinyint DEFAULT 0 COMMENT '状态：0未开始；1成功；2进行中；3校验失败',
  `ret_value` int DEFAULT NULL COMMENT '返回值',
  `ret_msg` varchar(2000) DEFAULT NULL COMMENT '错误详情',
  `error_files` int DEFAULT 0 COMMENT '错误文件数',
  `error_file_size` bigint DEFAULT 0 COMMENT '错误文件大小',
  `cmt` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  KEY `idx_inspect_zip_task_id` (`task_id`) USING BTREE COMMENT '任务ID索引',
  KEY `idx_inspect_zip_zip_id` (`zip_id`) USING BTREE COMMENT 'ISO包ID索引',
  KEY `idx_inspect_zip_file_id` (`file_id`) USING BTREE COMMENT '卷文件表主键索引',
  KEY `idx_inspect_zip_slot_id` (`slot_id`) USING BTREE COMMENT '介质槽ID索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='巡检包记录表';

-- 巡检对象累计统计（按对象维度一条记录；ISO 与介质分 inspect_type）
DROP TABLE IF EXISTS `tbl_inspect_stat`;
CREATE TABLE `tbl_inspect_stat` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `inspect_type` tinyint NOT NULL COMMENT '巡检对象类型：1=ISO；2=介质',
  `slot_id` bigint NOT NULL COMMENT '对象ID：inspect_type=1 时为 tbl_zip_file.id；inspect_type=2 时为介质 slot_id',
  `inspect_count` int NOT NULL DEFAULT 0 COMMENT '累计巡检次数',
  `last_inspect_time` datetime DEFAULT NULL COMMENT '最后巡检时间',
  `last_task_id` bigint DEFAULT NULL COMMENT '最后一次巡检任务ID（tbl_task.id）',
  `last_status` tinyint DEFAULT NULL COMMENT '最后一次检测状态，与 tbl_inspect_zip.status 一致：1成功；2进行中；3校验失败',
  `last_ret_value` int DEFAULT NULL COMMENT '最后返回值',
  `last_ret_msg` varchar(2000) DEFAULT NULL COMMENT '最后一次检查信息',
  `create_dt` datetime DEFAULT NULL COMMENT '创建时间',
  `update_dt` datetime DEFAULT NULL COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inspect_stat_type_obj` (`inspect_type`, `slot_id`) USING BTREE COMMENT '同类型同对象唯一一行',
  KEY `idx_inspect_stat_last_task` (`last_task_id`) USING BTREE COMMENT '按任务追溯'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='巡检对象统计表';

-- 巡检任务包内校验失败文件明细（记录所有包内文件失败项）
DROP TABLE IF EXISTS `tbl_task_error_file`;
CREATE TABLE `tbl_task_error_file` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `task_id` bigint DEFAULT NULL COMMENT '任务ID（tbl_task.id）',
  `slot_id` bigint DEFAULT NULL COMMENT '介质 slot_id',
  `zip_id` bigint DEFAULT NULL COMMENT 'tbl_zip_file.id',
  `src_file_id` bigint DEFAULT NULL COMMENT '原始文件id（包内文件在业务侧/卷表中的标识）',
  `iso_name` varchar(765) DEFAULT NULL COMMENT 'ISO 包名称',
  `folder_path` varchar(2000) DEFAULT NULL COMMENT '文件路径（包内相对或绝对路径）',
  `file_name` varchar(765) DEFAULT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `hash` varchar(65) DEFAULT NULL COMMENT '离线接收时文件 hash',
  `hash1` varchar(65) DEFAULT NULL COMMENT '巡检时文件 hash',
  `verify_dt` datetime DEFAULT NULL COMMENT '校验时间',
  `ret_value` int DEFAULT NULL COMMENT '返回值',
  `ret_msg` varchar(2000) DEFAULT NULL COMMENT '错误详情',
  `cmt` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`),
  KEY `idx_task_error_file_task_id` (`task_id`) USING BTREE COMMENT '任务ID索引',
  KEY `idx_task_error_file_zip_id` (`zip_id`) USING BTREE COMMENT 'ISO包ID索引',
  KEY `idx_task_error_file_slot_id` (`slot_id`) USING BTREE COMMENT '介质槽ID索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='巡检任务包内错误文件表';

-- 长期保存巡检任务档案包信息表
DROP TABLE IF EXISTS `tbl_check_patrol_task_item`;
CREATE TABLE `tbl_check_patrol_task_item`(
  `id` VARCHAR(64) NOT NULL COMMENT 'id',
  `task_id` VARCHAR(64)  NOT NULL COMMENT '巡检任务id',
  `strategy_id` VARCHAR(64) NOT NULL COMMENT '巡检策略id，即当前巡检任务是根据哪个巡检策略生成的',
  `file_id` VARCHAR(64)  NOT NULL COMMENT '档案包在存储系统中的文件id，主要用于磁存储上如果不存在文件，需要从光存储回迁',
  `check_task_id` VARCHAR(250)  NULL COMMENT '四性检测任务Id',
  `annual` VARCHAR(5)  DEFAULT NULL COMMENT '档案年度',
  `package_name` VARCHAR(100)  DEFAULT NULL COMMENT '档案包名称',
  `package_path` VARCHAR(100)  DEFAULT NULL COMMENT '档案包路径',
  `package_hash` VARCHAR(64)  DEFAULT NULL COMMENT '档案包的hash值，文件校验码，当前主要指md5值',
  `package_size` BIGINT  DEFAULT NULL COMMENT '档案包的大小，如果文件包的大小不一样，比较md5值意义就不大了',
  `template_id` VARCHAR(64)  NOT NULL COMMENT '四性检测模板id',
  `status` VARCHAR(20) NULL DEFAULT NULL COMMENT '任务状态  SUCCESS:成功  FAIL:失败  WAIT：等待提交  COMMIT: 已提交  PROCESSING：处理中  ABORT：中止',
  `recover` VARCHAR(20) NULL DEFAULT NULL COMMENT '恢复状态  SUCCESS:成功  FAIL:失败  NONEED：不需要恢复  COMMIT: 已提交  PROCESSING：处理中  ABORT：中止',
  `message` VARCHAR(1000) NULL COMMENT '错误信息描述',
  `archive_count` INT NULL DEFAULT 0 COMMENT '检测档案数量',
  `success_count` INT NULL DEFAULT 0 COMMENT '通过检测数量',
  `fail_count` INT NULL DEFAULT 0 COMMENT '未通过检测数量',
  `create_time` datetime NULL COMMENT '创建时间',
  `update_time` datetime NULL COMMENT '更新时间',
  `start_time` datetime DEFAULT NULL COMMENT '任务开始时间',
  `finished_time` datetime DEFAULT NULL COMMENT '任务完成时间',
  KEY `index_task_id` (`task_id`) USING BTREE,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '长期保存巡检任务档案包信息表';

-- 长期保存巡检过程信息记录表
DROP TABLE IF EXISTS `tbl_check_patrol_log`;
CREATE TABLE `tbl_check_patrol_log`(
  `id` VARCHAR(64) COMMENT '主键,无意义，UUID',
  `task_id` VARCHAR(64)  NOT NULL COMMENT '巡检任务id',
  `strategy_id` VARCHAR(64)  COMMENT '巡检策略id',
  `task_item_id` VARCHAR(64)  NOT NULL COMMENT '巡检任务项id',
  `info_type`  VARCHAR(10)   COMMENT '日志消息类别: DEBUG 调试消息, INFO 正常消息, WARN 警告消息, ERROR 错误消息',
  `check_file` VARCHAR(100)  NULL COMMENT '检测的程序文件名',
  `check_function` VARCHAR(100)  NULL COMMENT '检测的方法名',
  `message` VARCHAR(1000)  NULL COMMENT '检测过程消息',
  `create_time` datetime NULL COMMENT '创建时间',
  KEY `index_task_id` (`task_id`) USING BTREE,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8 COMMENT '长期保存巡检过程信息记录表';

-- 预警信息
DROP TABLE IF EXISTS `tbl_early_warning`;
CREATE TABLE `tbl_early_warning` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键 id',
  `title` varchar(255) DEFAULT NULL COMMENT '标题',
  `type` tinyint DEFAULT NULL COMMENT '0空间不足, 1温度异常, 2设备异常',
  `status` int DEFAULT 0 COMMENT '0未开始，1处理中，2已完成',
  `s_level` tinyint DEFAULT 0 COMMENT '0警告、1错误、2严重错误、3紧急',
  `create_date` datetime DEFAULT NULL COMMENT '预警信息创建时间',
  `lib_id` bigint DEFAULT NULL COMMENT '设备id',
  `user_id` int DEFAULT NULL COMMENT '创建用户的id',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 预警信息反馈内容
DROP TABLE IF EXISTS `tbl_early_warning_feedback`;
CREATE TABLE `tbl_early_warning_feedback` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键 id',
  `content` text COMMENT '反馈的内容',
  `user_name` varchar(50) DEFAULT NULL,
  `create_date` datetime DEFAULT NULL COMMENT '信息反馈的时间',
  `early_warning_id` int DEFAULT NULL COMMENT '预警信息的ID',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 异地备份设置
DROP TABLE IF EXISTS `tbl_remote_backup`;
CREATE TABLE `tbl_remote_backup` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键 id',
  `name` varchar(255) DEFAULT NULL COMMENT '名称',
  `aws_endpoint_url` varchar(255) DEFAULT NULL COMMENT 'endpoint',
  `aws_bucket` varchar(255) DEFAULT NULL COMMENT 'bucket',
  `aws_access_key_id` varchar(32) DEFAULT NULL COMMENT 'access_key_id',
  `aws_secret_access_key` varchar(32) DEFAULT NULL COMMENT 'secret_access_key',
  `aws_ssl` tinyint DEFAULT 0 COMMENT '是否使用ssl/TLS 0否1是',
  `cmt` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 无关联接收单
DROP TABLE IF EXISTS `tbl_data_receive_list`;
CREATE TABLE `tbl_data_receive_list` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `receive_num` varchar(50) DEFAULT NULL COMMENT '接收号',
  `transfer_unit` varchar(50) DEFAULT NULL COMMENT '移交单位',
  `transferor` varchar(20) DEFAULT NULL COMMENT '移交人',
  `transfer_date` datetime DEFAULT NULL COMMENT '移交时间',
  `receive_date` datetime DEFAULT NULL COMMENT '接收时间',
  `receive_unit` varchar(50) DEFAULT NULL COMMENT '接收单位',
  `receiver` varchar(20) DEFAULT NULL COMMENT '接收人',
  `files_count` bigint DEFAULT NULL COMMENT '总文件数',
  `files_size` bigint DEFAULT NULL COMMENT '总文件大小',
  `cmt` varchar(200) DEFAULT NULL COMMENT '数据描述',
  `update_dt` datetime DEFAULT NULL COMMENT '更新时间',
  `create_dt` datetime DEFAULT NULL COMMENT '创建时间',
  `status` tinyint DEFAULT 0 COMMENT '数据接收单状态:新建：0,接收文件成功：1 ,警告文件有部分校验失败：20,删除 -1',
  `resource` tinyint DEFAULT NULL COMMENT '数据来源:0硬盘1光盘2在线(网盘)3离线备份',
  `volume_id` int DEFAULT NULL COMMENT '磁盘卷卷ID',
  `import_method` int DEFAULT 0 COMMENT '导入方式，0 普通流程，1 批量流程,2 定时任务',
  `nums` int DEFAULT 0 COMMENT '载体数量',
  `medium_sn` varchar(50) DEFAULT NULL COMMENT '载体编号',
  `data_class_id` int DEFAULT NULL COMMENT '数据分类id',
  `local_path` varchar(50) DEFAULT NULL COMMENT '接收数据存放路径',
  `schedule_enable` tinyint DEFAULT 0 COMMENT '是否启用定时任务 禁用0 启用1',
  `schedule_cron` varchar(50) DEFAULT NULL COMMENT '定时任务cron',
  `schedule_cron_desc` varchar(100) DEFAULT NULL COMMENT '接收数据存放路径',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

--  接收单操作记录
DROP TABLE IF EXISTS `tbl_data_receive_log`;
CREATE TABLE `tbl_data_receive_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `receive_num` varchar(50) DEFAULT NULL COMMENT '接收单号',
  `operate_type` tinyint DEFAULT 0 COMMENT '0:上传 1:修改 2:删除 3执行',
  `content` text COMMENT '显示内容', 
  `create_date` datetime DEFAULT NULL  COMMENT '创建时间',
  `user_id` int DEFAULT NULL  COMMENT '操作用户的id',
  `result` tinyint DEFAULT 0 COMMENT '结果返回1成功0失败',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备注',
  `is_delete` tinyint DEFAULT 0 COMMENT '0正常1删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

--  数据分类、数据条目
DROP TABLE IF EXISTS `tbl_data_classification`;
CREATE TABLE `tbl_data_classification` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `data_name` varchar(255) DEFAULT NULL COMMENT '分类名称',
  `parent` int DEFAULT 0 COMMENT '上级分类ID，为0表示为根',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备注',
  `code` varchar(50) DEFAULT NULL COMMENT '分类编码',
  `data_type` tinyint DEFAULT 0 COMMENT '分类规则 0 数据来源 1 电子数据类型',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_data_receive_tasks`;
CREATE TABLE `tbl_data_receive_tasks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_id` bigint NOT NULL,
  `receive_id` bigint NOT NULL,
  `cmt` varchar(255) DEFAULT NULL,
  PRIMARY KEY (id)
);

--  存证验证记录列表
DROP TABLE IF EXISTS `tbl_credible_prove`;
CREATE TABLE `tbl_credible_prove` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` int NOT NULL,
    `task_id` bigint NOT NULL,
    `task_item_id` bigint NOT NULL,
    `zip_file_id` bigint NOT NULL,
    `bus_flag` varchar(50) NOT NULL,
    `package_remark` varchar(765) DEFAULT NULL,
    `volume_id` int DEFAULT NULL,
    `optical_path` varchar(4096) DEFAULT NULL,
    `file_name` varchar(765) NOT NULL,
    `file_size` bigint DEFAULT NULL,
    `pack_file_count` int DEFAULT NULL,
    `hash` varchar(65) DEFAULT NULL,
    `verify_hash` varchar(65) DEFAULT NULL,
    `create_date` datetime DEFAULT NULL,
    `certify_date` varchar(50) DEFAULT NULL,
    `verify_date` varchar(50) DEFAULT NULL,
    `prove_uuid` varchar(65) NOT NULL,
    `prove_file_path` varchar(4096) DEFAULT NULL,
    `json_path` text DEFAULT NULL,
    `status` int DEFAULT 0,
    `package_volume_id` int DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

--  验证记录列表
DROP TABLE IF EXISTS `tbl_credible_verify`;
CREATE TABLE `tbl_credible_verify` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` int NOT NULL,
    `credible_prove_id` bigint NOT NULL,
    `zip_file_id` bigint NOT NULL,
    `bus_flag` varchar(50) NOT NULL,
    `description` varchar(50) DEFAULT NULL,
    `file_name` varchar(765) NOT NULL,
    `prove_hash` varchar(65) DEFAULT NULL,
    `verify_hash` varchar(65) DEFAULT NULL,
    `create_date` datetime DEFAULT NULL,
    `certify_date` varchar(50) DEFAULT NULL,
    `verify_date` varchar(50) DEFAULT NULL,
    `verify_uuid` varchar(65) NOT NULL,
    `verify_status` int DEFAULT 2,
    `report_verify_hash` varchar(65) DEFAULT NULL,
    `report_date` varchar(50) DEFAULT NULL,
    `report_path` varchar(4096) DEFAULT NULL,
    `report_status`  int DEFAULT 0,
    `report_verify_status` int DEFAULT NULL,
    `json_path` text DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
-- S3日志
DROP TABLE IF EXISTS `tbl_api_log`;
CREATE TABLE `tbl_api_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '记录id',
  `file_name` varchar(500) DEFAULT NULL COMMENT '文件名',
  `call_type` tinyint DEFAULT 0 COMMENT '被动调用0 主动调用1',
  `caller_name` varchar(500) DEFAULT NULL COMMENT '第三方系统名称，接口管理则存ip',
  `method_name` varchar(500) DEFAULT NULL COMMENT '蓝光系统接口名称',
  `method_desc` varchar(500) DEFAULT NULL COMMENT '蓝光系统接口功能描述',
  `caller_user_name` varchar(500) DEFAULT NULL COMMENT '调用接口的用户名',
  `call_start_time` datetime DEFAULT NULL COMMENT '调用开始时间',
  `call_end_time` datetime DEFAULT NULL COMMENT '调用结束时间',
  `call_result` tinyint DEFAULT 0 COMMENT '调用成功0 调用失败1',
  `cmt` varchar(200) DEFAULT NULL,
  `del_flag` tinyint DEFAULT 0 COMMENT '0:正常  1:已删除',
  `req_query` text DEFAULT NULL COMMENT '请求参数',
  `res_body` text DEFAULT NULL COMMENT '返回参数',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
-- 文件类型统计
DROP TABLE IF EXISTS `tbl_file_stat`;
CREATE TABLE `tbl_file_stat` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `volume_id` bigint DEFAULT NULL,
  `task_id` bigint DEFAULT NULL,
  `files_type` varchar(10) DEFAULT NULL COMMENT '文件类型 _total 全部，_empty 空，_error 乱码，_repeat 重复，pdf后缀类型等',
  `files_count` bigint DEFAULT NULL COMMENT '总文件数',
  `files_size` bigint DEFAULT NULL COMMENT '总文件大小',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
-- 数据分类对应卷
DROP TABLE IF EXISTS `tbl_volume_dataclass`;
CREATE TABLE `tbl_volume_dataclass` (
  `volume_id` int NOT NULL COMMENT '逻辑卷编号',
  `data_class_id` int NOT NULL COMMENT '数据分类编号',
  PRIMARY KEY (`volume_id`,`data_class_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_schedule_job`;
CREATE TABLE `tbl_schedule_job` (
  `id` bigint NOT NULL AUTO_INCREMENT  COMMENT '记录id',
  `task_name` varchar(255) NOT NULL COMMENT '定时任务名称',
  `func_name` varchar(255) NOT NULL COMMENT '定时任务方法别名',
  `func_sign` varchar(255) NOT NULL COMMENT '定时任务方法名',
  `func_param` varchar(255) DEFAULT NULL COMMENT '定时任务方法参数',
  `enable` tinyint DEFAULT 1 COMMENT '是否启用 禁用0 启用1',
  `cron` varchar(255) NOT NULL COMMENT 'cron表达式',
  `cron_desc` varchar(255) DEFAULT NULL COMMENT 'cron自然语言描述',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注说明',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备用字段',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

DROP TABLE IF EXISTS `tbl_task_certif_status`;
CREATE TABLE `tbl_task_certif_status` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '记录id',
  `task_id` bigint NOT NULL COMMENT '任务id',
  `task_item_id` bigint NOT NULL COMMENT '任务项id',
  `task_type` int DEFAULT NULL COMMENT '任务类型',
  `task_mode` tinyint DEFAULT NULL COMMENT '任务模式',
  `status` tinyint DEFAULT 0 COMMENT '任务项文件存证状态 0:未开始 1:进行中 2:已完成 3:失败',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备用字段',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 数据字典分类
DROP TABLE IF EXISTS `tbl_dict_category`;
CREATE TABLE `tbl_dict_category` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '字典分类id',
  `category_name` varchar(255) DEFAULT NULL COMMENT '字典分类名称',
  `show_status` tinyint DEFAULT 1 COMMENT '是否显示(1显示,0隐藏)',
  `show_sort` int DEFAULT null COMMENT '显示顺序',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `is_build_in` tinyint DEFAULT 0 COMMENT '是否内置(1是,0否)',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备用字段',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci  COMMENT '数据字典分类表';

-- 数据字典
DROP TABLE IF EXISTS `tbl_dict`;
CREATE TABLE `tbl_dict` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '字典id',
  `category_id` bigint NOT NULL COMMENT '字典分类ID',
  `dict_name` varchar(255) DEFAULT NULL COMMENT '字典名称',
  `show_status` tinyint DEFAULT 1 COMMENT '是否显示(1显示,0隐藏)',
  `show_sort` int DEFAULT null COMMENT '显示顺序',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `is_build_in` tinyint DEFAULT 0 COMMENT '是否内置(1是,0否)',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备用字段',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT '数据字典表';

-- 数据字典项
DROP TABLE IF EXISTS `tbl_dict_item`;
CREATE TABLE `tbl_dict_item` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '字典项id',
  `dict_id` bigint NOT NULL COMMENT '字典ID',
  `item_name` varchar(255) DEFAULT NULL COMMENT '字典项名称',
  `item_code` varchar(255) DEFAULT NULL COMMENT '字典项编码',
  `show_status` tinyint DEFAULT 1 COMMENT '是否显示(1显示,0隐藏)',
  `show_sort` int DEFAULT null COMMENT '显示顺序',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `is_build_in` tinyint DEFAULT 0 COMMENT '是否内置(1是,0否)',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备用字段',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT '数据字典项表';


-- 接口管理
DROP TABLE IF EXISTS `tbl_api_interface`;
CREATE TABLE `tbl_api_interface` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '接口id',
  `api_name` varchar(255) DEFAULT NULL COMMENT '接口名称',
  `api_type` varchar(255) DEFAULT NULL COMMENT '接口协议类型（目前仅支持http/https接口注册），http https',
  `api_method` varchar(255) DEFAULT NULL COMMENT '接口请求方式，GET POST PUT DELETE',
  `host` varchar(255) DEFAULT NULL COMMENT 'ip或域名',
  `port` int DEFAULT NULL COMMENT '端口号',
  `api_path` varchar(255) DEFAULT NULL COMMENT '接口路径',
  `api_url` varchar(255) DEFAULT NULL COMMENT '完整接口地址',
  `enable` tinyint DEFAULT 1 COMMENT '是否启用 禁用0 启用1',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_time` datetime DEFAULT NULL COMMENT '修改时间',
  `is_build_in` tinyint DEFAULT 0 COMMENT '是否内置(1是,0否)',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备用字段',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT '接口管理表';

-- 导入目录检索文件记录表
DROP TABLE IF EXISTS `tbl_import_folder_log`;
CREATE TABLE `tbl_import_folder_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '导入编号',
  `type` int DEFAULT 0 COMMENT '类别',
  `file_name` varchar(765) DEFAULT NULL COMMENT '文件名',
  `create_time` datetime DEFAULT NULL COMMENT '接收时间',
  `total_data` bigint DEFAULT 0 COMMENT '导入数量',
  `status` int DEFAULT 1 COMMENT '导入状态，0已完成，1导入中，2导入失败',
  `title_id_list` varchar(255) DEFAULT NULL COMMENT '表头编号集',
  `cmt` varchar(255) DEFAULT NULL COMMENT '备用字段',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 导入目录检索表头字典
DROP TABLE IF EXISTS `tbl_import_folder_title`;
CREATE TABLE `tbl_import_folder_title` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '表头编号',
  `type` int DEFAULT 0 COMMENT '类别',
  `file_title` varchar(765) DEFAULT NULL COMMENT '文件中表头',
  `table_title` varchar(50) DEFAULT NULL COMMENT '表中表头',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 导入目录检索数据表
DROP TABLE IF EXISTS `tbl_import_folder_data`;
CREATE TABLE `tbl_import_folder_data` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '数据编号',
  `log_id` bigint NOT NULL COMMENT '导入编号',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 灾备平台特有表
-- 待下载文件表
DROP TABLE IF EXISTS `tbl_wait_download_file`;
CREATE TABLE `tbl_wait_download_file` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `file_name` varchar(765) NOT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `file_path` varchar(765) NOT NULL COMMENT '文件路径',
  `create_time` datetime DEFAULT NULL COMMENT '文件生成时间',
  `user_id` int NOT NULL COMMENT '用户id',
  `data_type` int NOT NULL COMMENT '数据类型，0：开放数据，1：存证数据，2：日志文件，3：开放/存证',
  `org_depa_id` int DEFAULT NULL COMMENT '数据所属机构部门id',
  `download_count` int DEFAULT 0 COMMENT '下载次数',
  `details_count` int DEFAULT 0 COMMENT '明细数量',
  `system_type` tinyint DEFAULT NULL COMMENT '系统类型 0灾备平台，1开放平台',
  `remark` varchar(500) DEFAULT NULL COMMENT '说明',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  `file_status` tinyint DEFAULT 0 COMMENT '文件状态 0：已准备好，1：待准备，-1：文件异常，-2：文件已删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 待下载文件明细关联表
DROP TABLE IF EXISTS `tbl_download_details`;
CREATE TABLE `tbl_download_details` (
  `wait_download_id` bigint NOT NULL COMMENT '待下载文件表id',
  `csv_details_id` bigint NOT NULL COMMENT 'csv文件明细表id',
  `cmt` varchar(200) DEFAULT NULL COMMENT '补充说明',
  PRIMARY KEY (`wait_download_id`,`csv_details_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 文件下载记录表
DROP TABLE IF EXISTS `tbl_download_record`;
CREATE TABLE `tbl_download_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `wait_download_id` bigint NOT NULL COMMENT '待下载文件表id（外键）',
  `file_name` varchar(765) NOT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `file_path` varchar(765) NOT NULL COMMENT '文件路径',
  `operate_time` datetime DEFAULT NULL COMMENT '操作时间',
  `user_id` int NOT NULL COMMENT '操作用户id',
  `data_type` int NOT NULL COMMENT '数据类型，0：开放数据，1：存证数据',
  `org_depa_id` int DEFAULT NULL COMMENT '数据所属机构部门id',
  `details_count` int DEFAULT 0 COMMENT '明细数量',
  `system_type` tinyint DEFAULT NULL COMMENT '系统类型 0灾备平台，1开放平台',
  `remark` varchar(500) DEFAULT NULL COMMENT '说明',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 文件上传记录表
DROP TABLE IF EXISTS `tbl_upload_record`;
CREATE TABLE `tbl_upload_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `file_name` varchar(765) NOT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `operate_time` datetime DEFAULT NULL COMMENT '操作时间',
  `user_id` int NOT NULL COMMENT '操作用户id',
  `data_type` int NOT NULL COMMENT '数据类型，0：开放数据，1：存证数据',
  `org_depa_id` int DEFAULT NULL COMMENT '数据所属机构部门id',
  `details_count` int DEFAULT 0 COMMENT '明细数量',
  `system_type` tinyint DEFAULT NULL COMMENT '系统类型 0灾备平台，1开放平台',
  `remark` varchar(500) DEFAULT NULL COMMENT '说明',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 上传文件明细关联表
DROP TABLE IF EXISTS `tbl_upload_details`;
CREATE TABLE `tbl_upload_details` (
  `upload_id` bigint NOT NULL COMMENT '待下载文件表id',
  `csv_details_id` bigint NOT NULL COMMENT 'csv文件明细表id',
  `cmt` varchar(200) DEFAULT NULL COMMENT '补充说明',
  PRIMARY KEY (`upload_id`,`csv_details_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- csv文件明细表
DROP TABLE IF EXISTS `tbl_csv_details`;
CREATE TABLE `tbl_csv_details` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `number` bigint DEFAULT NULL COMMENT '序号',
  `file_name` varchar(765) NOT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `file_path` varchar(765) NOT NULL COMMENT '文件路径',
  `file_hash` varchar(65) NOT NULL COMMENT '文件SM3',
  `zip_file_id` bigint NOT NULL COMMENT '数据包id',
  `manage_id` varchar(20) NOT NULL COMMENT '管理id',
  `package_file_count` bigint DEFAULT 0 COMMENT '数据包内文件数量',
  `package_file_hash` varchar(65) NOT NULL COMMENT '数据包内文件列表SM3',
  `chain_id` varchar(255) DEFAULT NULL COMMENT '证据链id',
  `prove_file_path` varchar(765) DEFAULT NULL COMMENT '存证证书文件路径',
  `verify_result` tinyint DEFAULT NULL COMMENT '1成功 2失败',
  `system_type` tinyint DEFAULT NULL COMMENT '系统类型 0灾备平台，1开放平台',
  `type` tinyint DEFAULT NULL COMMENT '存证类型： 0存证，1验证',
  `tx_hash` varchar(255) DEFAULT NULL COMMENT '交易hash',
  `cert_hash` varchar(255) DEFAULT NULL COMMENT '证书交易hash',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 存证记录明细表
DROP TABLE IF EXISTS `tbl_evidence_details`;
CREATE TABLE `tbl_evidence_details` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `uuid` varchar(255) DEFAULT NULL COMMENT '链上唯一id',
  `record_id` bigint NOT NULL COMMENT '存证记录id（外键）',
  `number` bigint DEFAULT NULL COMMENT '序号',
  `file_name` varchar(765) NOT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `file_path` varchar(765) NOT NULL COMMENT '文件路径',
  `file_hash` varchar(65) NOT NULL COMMENT '文件SM3',
  `zip_file_id` bigint NOT NULL COMMENT '数据包id',
  `manage_id` varchar(20) NOT NULL COMMENT '管理id',
  `package_file_count` bigint DEFAULT 0 COMMENT '数据包内文件数量',
  `package_file_hash` varchar(65) NOT NULL COMMENT '数据包内文件列表SM3',
  `prove_file_path` varchar(765) DEFAULT NULL COMMENT '存证证书文件路径',
  `system_type` tinyint DEFAULT NULL COMMENT '系统类型 0灾备平台，1开放平台',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  `status` tinyint DEFAULT 0 COMMENT '状态，0待存证， 1存证中， 2存证完成， 3存证失败',
  `chain_status` tinyint DEFAULT NULL COMMENT '上链状态，0 未上链，1 上链中 2 上链成功 3 上链失败',
  `chain_id` varchar(255) DEFAULT NULL COMMENT '证据链id',
  `tx_hash` varchar(255) DEFAULT NULL COMMENT '交易hash，当上链成功,chain_status=2 时，不为空',
  `cert_status` tinyint DEFAULT NULL COMMENT '证书状态，0 初始化中 1 证书生成中 2 证书生成 3 证书生成失败',
  `cert_url` varchar(255) DEFAULT NULL COMMENT '证书地址，当cert_status=2 时，不为空',
  `cert_hash` varchar(255) DEFAULT NULL COMMENT '证书交易hash，当cert_status=2 时，不为空',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 验证记录明细表
DROP TABLE IF EXISTS `tbl_verify_details`;
CREATE TABLE `tbl_verify_details` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `record_id` bigint NOT NULL COMMENT '存证记录id（外键）',
  `number` bigint DEFAULT NULL COMMENT '序号',
  `file_name` varchar(765) NOT NULL COMMENT '文件名称',
  `file_size` bigint DEFAULT NULL COMMENT '文件大小',
  `file_path` varchar(765) NOT NULL COMMENT '文件路径',
  `file_hash` varchar(65) NOT NULL COMMENT '文件SM3',
  `zip_file_id` bigint NOT NULL COMMENT '数据包id',
  `manage_id` varchar(20) NOT NULL COMMENT '管理id',
  `package_file_count` bigint DEFAULT 0 COMMENT '数据包内文件数量',
  `package_file_hash` varchar(65) NOT NULL COMMENT '数据包内文件列表SM3',
  `chain_id` varchar(255) DEFAULT NULL COMMENT '证据链id',
  `verify_result` tinyint DEFAULT NULL COMMENT '1失败 2成功',
  `system_type` tinyint DEFAULT NULL COMMENT '系统类型 0灾备平台，1开放平台',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 存证记录表
DROP TABLE IF EXISTS `tbl_evidence_record_drp`;
CREATE TABLE `tbl_evidence_record_drp` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `upload_record_id` bigint NOT NULL COMMENT '上传记录id（外键）',
  `file_name` varchar(765) NOT NULL COMMENT '文件名称',
  `details_count` int DEFAULT 0 COMMENT '明细数量',
  `operate_time` datetime DEFAULT NULL COMMENT '操作时间',
  `user_id` int NOT NULL COMMENT '操作用户id',
  `org_depa_id` int DEFAULT NULL COMMENT '数据所属机构部门id',
  `status` tinyint DEFAULT NULL COMMENT '状态，0未存证 1已存证',
  `remark` varchar(500) DEFAULT NULL COMMENT '说明',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 验证记录表
DROP TABLE IF EXISTS `tbl_verify_record_drp`;
CREATE TABLE `tbl_verify_record_drp` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `upload_record_id` bigint NOT NULL COMMENT '上传记录id（外键）',
  `file_name` varchar(765) NOT NULL COMMENT '文件名称',
  `details_count` int DEFAULT 0 COMMENT '明细数量',
  `operate_time` datetime DEFAULT NULL COMMENT '操作时间',
  `operate_stage` tinyint DEFAULT NULL COMMENT '验证环节（类型） 1 手动核验， 2 数据备份， 3 数据迁移， 4 数据同步',
  `user_id` int NOT NULL COMMENT '操作用户id',
  `org_depa_id` int DEFAULT NULL COMMENT '数据所属机构部门id',
  `status` tinyint DEFAULT NULL COMMENT '状态，0未验证 1验证通过 2验证不通过 3验证部分通过',
  `remark` varchar(500) DEFAULT NULL COMMENT '说明',
  `task_no` varchar(500) DEFAULT NULL COMMENT '校验任务编号',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 待下载文件和任务关联表
DROP TABLE IF EXISTS `tbl_wait_download_file_task`;
CREATE TABLE `tbl_wait_download_file_task` (
  `wait_download_id` bigint NOT NULL COMMENT '待下载文件表id（外键）',
  `task_id` bigint NOT NULL COMMENT '任务id（外键）',
  PRIMARY KEY (`wait_download_id`,`task_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- iso存储位置信息表
DROP TABLE IF EXISTS `tbl_iso_location`;
CREATE TABLE `tbl_iso_location` (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT 'iso位置信息id',
`iso_id` bigint NULL COMMENT 'iso存储在tbl_file表中的id',
`zip_file_id` bigint NULL COMMENT '对应tbl_zip_file表中id',
`iso_name` varchar(255) DEFAULT NULL COMMENT 'iso名称',
`hash` varchar(65) DEFAULT NULL COMMENT 'iso hash',
`location` varchar(255) DEFAULT NULL COMMENT '位置:如光盘库1号托盘2号位',
`create_time` datetime DEFAULT NULL COMMENT '创建时间',
`lib_id` bigint NULL COMMENT '所在设备id：tbl_disc_lib',
`mag_id` bigint NULL COMMENT '所在片匣(盘笼)id',
`slot_id` bigint NULL COMMENT '所在介质id',
`volume_id` bigint NULL COMMENT '介质卷id',
`task_id` bigint NULL COMMENT '任务id',
`backup_path` varchar(255) NULL COMMENT 'iso保存路径',
`status` tinyint DEFAULT 0 COMMENT '状态 0 新建 1 已备份 6 被新备份覆盖',
`backup_type` tinyint DEFAULT 0 COMMENT '备份类型 0 光盘 1 磁盘 2 磁带 3 热存储',
`cmt` varchar(255) DEFAULT NULL COMMENT '备用字段',
PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'iso保存位置信息表';

-- iso任务同步表
DROP TABLE IF EXISTS `tbl_iso_task_sync`;
CREATE TABLE `tbl_iso_task_sync` (
`id` bigint NOT NULL AUTO_INCREMENT COMMENT 'iso任务同步id',
`task_id` bigint NULL COMMENT '任务id',
`type` bigint NULL COMMENT '类型 0 接收任务 1 备份任务',
`volume_id` bigint NULL COMMENT '介质卷id',
`status` tinyint DEFAULT 0 COMMENT '状态 0 新建 10 同步中 1 已同步',
`create_time` datetime DEFAULT NULL COMMENT '创建时间',
PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci COMMENT 'iso任务同步表';

-- 异地热备记录表
DROP TABLE IF EXISTS `tbl_hot_backup_record`;
CREATE TABLE `tbl_hot_backup_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `schedule_job_id` bigint DEFAULT NULL COMMENT '定时任务id',
  `from_path` varchar(765) NOT NULL COMMENT '数据源路径',
  `to_path` varchar(765) NOT NULL COMMENT '数据目的路径',
  `size` bigint DEFAULT NULL COMMENT '文件大小',
  `progress` int DEFAULT NULL COMMENT '执行进度',
  `status` tinyint DEFAULT NULL COMMENT '状态，0：进行中， 1：成功， 2：失败',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '结束时间',
  `error_message` varchar(500) DEFAULT NULL COMMENT '失败信息',
  `task_id` bigint DEFAULT NULL COMMENT '任务id',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

-- 热备恢复记录表
DROP TABLE IF EXISTS `tbl_hot_restore_record`;
CREATE TABLE `tbl_hot_restore_record` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '自增ID',
  `schedule_job_id` bigint DEFAULT NULL COMMENT '定时任务id',
  `from_path` varchar(765) NOT NULL COMMENT '数据源路径',
  `to_path` varchar(765) NOT NULL COMMENT '数据目的路径',
  `progress` int DEFAULT NULL COMMENT '执行进度',
  `status` tinyint DEFAULT NULL COMMENT '状态，0：进行中， 1：成功， 2：失败',
  `start_time` datetime DEFAULT NULL COMMENT '开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '开始时间',
  `error_message` varchar(500) DEFAULT NULL COMMENT '失败信息',
  `cmt` varchar(500) DEFAULT NULL COMMENT '数据描述',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;

--  设备关联表
DROP TABLE IF EXISTS `tbl_device_device`;
CREATE TABLE `tbl_device_device` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '自增id',
  `lib_id_c` int DEFAULT NULL COMMENT '信息发送方设备id',
  `lib_id_s` int DEFAULT NULL COMMENT '信息接收方设备id',
  `cmt` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;


-- ----------------------------
-- 存储过程必须加上DELIMITER, 否则用mysql < disc_files.sql会出错！
-- 如果在DBerver中执行此sql文件，则需要替换所有;;为&&
-- Procedure structure for recursiveSlotfolder
-- ----------------------------
DROP PROCEDURE IF EXISTS `recursiveSlotfolder`;
DELIMITER ;;
CREATE PROCEDURE `recursiveSlotfolder`(IN slotId INT,IN tableId INT,IN volumeId INT)
BEGIN
  DECLARE done INT DEFAULT 0;

  /*向目录表填充数据*/
  set @file_sql = CONCAT('INSERT INTO tbl_slot_folder_',tableId,'(id,`name`,`folder_path`,`disc_path`,`s_level`,parent,sum_files,files,subs,slot_id)
  SELECT id,`name`,`folder_path`,`disc_path`,`s_level`,parent,sum_files,files,subs,',slotId,' as slot_id FROM tbl_folder_',volumeId,' as tf1  WHERE tf1.id IN 
  (SELECT DISTINCT parent FROM tbl_slot_folder_',tableId,' as sf1 WHERE sf1.slot_id = ',slotId,') and tf1.id NOT IN 
  (SELECT id FROM tbl_slot_folder_',tableId,' as sf2 WHERE sf2.slot_id = ',slotId,')');
  PREPARE insstmt FROM @file_sql;
  EXECUTE insstmt;  
  SET done = ROW_COUNT();
  DEALLOCATE PREPARE insstmt;

  IF done THEN
  /*调用递归补充数据*/
  CALL recursiveSlotfolder(slotId,tableId,volumeId);
  END IF;
END;
;;
DELIMITER ;

-- ----------------------------
-- Procedure structure for insertSlotfile
-- ----------------------------
DROP PROCEDURE IF EXISTS `insertSlotfile`;
DELIMITER ;;
CREATE PROCEDURE `insertSlotfile`(IN slotId INT)
label: BEGIN
  DECLARE tableId VARCHAR(20); /*光盘所属表*/
  DECLARE volumeId INT; /*分区编号，用来确定文件表、目录表*/
  DECLARE numb INT DEFAULT 10;/*每10张光盘对应一个表，每个硬盘对应一个表*/

/*事务*/
DECLARE EXIT HANDLER FOR  SQLEXCEPTION ROLLBACK ;   
START TRANSACTION;
  IF numb < 1 THEN  
  LEAVE label; /* 退出存储过程*/
  END IF;
  /* 硬盘slotId>=1000000 */
  IF slotId < 1000000   THEN
    SET tableId = ((slotId-1) DIV numb) + 1;
  ELSEIF slotId >= 1000000 THEN
    SET tableId = slotId;
  END IF;

  /*先创建表*/
  CALL procCreateFileTable('tbl_slot_file',tableId,0,0);
  CALL procCreateFileTable('tbl_slot_folder',tableId,0,0);

  /*获取卷编号*/
  SELECT
  tbl_volume_slot.volume_id INTO volumeId   FROM tbl_volume_slot WHERE tbl_volume_slot.slot_id = slotId;

  SET @file_sql = CONCAT('INSERT into tbl_slot_file_',tableId,'(id,uuid,folder_id,file_name,file_disc_name,file_size,hash,task_id,items_id,create_date,`status`,slot_id,content_type,storage_class,thumbs,meta_data)
  SELECT id,uuid,folder_id,file_name,file_disc_name,file_size,hash,task_id,items_id,create_date,`status`,slot_id,content_type,storage_class,thumbs,meta_data FROM tbl_file_',volumeId ,'_a WHERE slot_id = ',slotId,' and id not in(select id from tbl_slot_file_',tableId,' WHERE slot_id = ',slotId,')');
  PREPARE filestmt FROM @file_sql;
  EXECUTE filestmt;
  DEALLOCATE PREPARE filestmt;

  /*向目录表填充数据*/
  SET @folder_sql = CONCAT('INSERT INTO tbl_slot_folder_',tableId,'(id,`name`,`folder_path`,`disc_path`,`s_level`,parent,sum_files,files,subs,slot_id)
  SELECT id,`name`,`folder_path`,`disc_path`,`s_level`,parent,sum_files,files,subs,',slotId,' as slot_id FROM tbl_folder_',volumeId,' tf1 WHERE tf1.id IN 
  (SELECT DISTINCT folder_id FROM tbl_slot_file_',tableId,' sf1 WHERE sf1.slot_id = ',slotId,') and tf1.id not IN(select id from tbl_slot_folder_',tableId,' tsf2 where tsf2.slot_id = ',slotId,')');
  PREPARE foldstmt FROM @folder_sql;
  EXECUTE foldstmt;
  DEALLOCATE PREPARE foldstmt;
  /*调用递归补充数据*/
  SET @@max_sp_recursion_depth = 100;
  CALL recursiveSlotfolder(slotId,tableId,volumeId);
COMMIT; 
END;
;;
DELIMITER ;

-- ----------------------------
-- Procedure structure for recursiveTaskfolder
-- ----------------------------
DROP PROCEDURE IF EXISTS `recursiveTaskfolder`;
DELIMITER ;;
CREATE PROCEDURE `recursiveTaskfolder`(IN taskId INT,IN volumeId INT)
BEGIN
  DECLARE done INT DEFAULT 0;

  SET @folder_sql = CONCAT('INSERT INTO tbl_task_folder_',taskId,'(id,`name`,`folder_path`,`disc_path`,`s_level`,parent,sum_files,files,subs,volume_id)
  SELECT id,`name`,`folder_path`,`disc_path`,`s_level`,parent,sum_files,files,subs,',volumeId,' as volume_id FROM tbl_folder_',volumeId,' as tf1 WHERE tf1.id IN
  (SELECT DISTINCT parent FROM tbl_task_folder_',taskId,' as sf1 WHERE sf1.volume_id = ',volumeId,') and tf1.id NOT IN
  (SELECT id FROM tbl_task_folder_',taskId,' as sf2 WHERE sf2.volume_id = ',volumeId,')');
  PREPARE insstmt FROM @folder_sql;
  EXECUTE insstmt;
  SET done = ROW_COUNT();
  DEALLOCATE PREPARE insstmt;

  IF done THEN
  CALL recursiveTaskfolder(taskId,volumeId);
  END IF;
END;
;;
DELIMITER ;

-- ----------------------------
-- Procedure structure for insertTaskfile
-- ----------------------------
DROP PROCEDURE IF EXISTS `insertTaskfile`;
DELIMITER ;;
CREATE PROCEDURE `insertTaskfile`(IN taskId INT,IN inVolumeId INT)
label: BEGIN
  DECLARE volumeId INT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
  START TRANSACTION;

  IF taskId IS NULL OR taskId < 1 THEN
    LEAVE label;
  END IF;

  CALL procCreateFileTable('tbl_task_file',taskId,0,0);
  CALL procCreateFileTable('tbl_task_folder',taskId,0,0);

  IF inVolumeId IS NULL OR inVolumeId = 0 THEN
    SELECT tbl_task_items.volume_id INTO volumeId FROM tbl_task_items WHERE tbl_task_items.task_id = taskId LIMIT 1;
  ELSE
    SET volumeId = inVolumeId;
  END IF;
  IF volumeId IS NULL OR volumeId = 0 THEN
    ROLLBACK;
    LEAVE label;
  END IF;

  SET @file_sql = CONCAT('INSERT INTO tbl_task_file_',taskId,'(id,uuid,folder_id,file_name,file_remark,file_disc_name,file_size,hash,task_id,items_id,create_date,`status`,slot_id,content_type,storage_class,thumbs,meta_data,volume_id)
  SELECT id,uuid,folder_id,file_name,file_remark,file_disc_name,file_size,hash,task_id,items_id,create_date,`status`,slot_id,content_type,storage_class,thumbs,meta_data,',volumeId,' as volume_id FROM tbl_file_',volumeId,'_a WHERE task_id = ',taskId,' and id not in(select id from tbl_task_file_',taskId,' where volume_id = ',volumeId,')');
  PREPARE filestmt FROM @file_sql;
  EXECUTE filestmt;
  DEALLOCATE PREPARE filestmt;

  SET @folder_sql = CONCAT('INSERT INTO tbl_task_folder_',taskId,'(id,`name`,`folder_path`,`disc_path`,`s_level`,parent,sum_files,files,subs,volume_id)
  SELECT id,`name`,`folder_path`,`disc_path`,`s_level`,parent,sum_files,files,subs,',volumeId,' as volume_id FROM tbl_folder_',volumeId,' tf1 WHERE tf1.id IN
  (SELECT DISTINCT folder_id FROM tbl_task_file_',taskId,' sf1 WHERE sf1.volume_id = ',volumeId,') and tf1.id not IN(select id from tbl_task_folder_',taskId,' tsf2 where tsf2.volume_id = ',volumeId,')');
  PREPARE foldstmt FROM @folder_sql;
  EXECUTE foldstmt;
  DEALLOCATE PREPARE foldstmt;

  SET @@max_sp_recursion_depth = 100;
  CALL recursiveTaskfolder(taskId,volumeId);
  COMMIT;
END;
;;
DELIMITER ;

-- ----------------------------
-- Procedure structure for procCreateFileTable
-- ----------------------------
DROP PROCEDURE IF EXISTS `procCreateFileTable`;
DELIMITER ;;
CREATE PROCEDURE `procCreateFileTable`(IN tableType VARCHAR(20),IN volumeId INT,IN markId INT,IN maxFileId BIGINT)
BEGIN
  DECLARE tableId VARCHAR(20);

  IF markId = 0 THEN
    SET tableId = volumeId;
  ELSEIF markId = 1 THEN
    SET tableId = CONCAT(volumeId,'_a');
  END IF;
  IF maxFileId = 0 THEN
    SET maxFileId = 1;
  END IF;
  /*创建文件表*/
  IF tableType = 'tbl_slot_file' THEN
    SET @creat_sql = CONCAT("
CREATE TABLE IF NOT EXISTS `tbl_slot_file_",tableId,"` (
`id` bigint NOT NULL,
`uuid` varchar(64),
`folder_id` bigint NOT NULL,
`file_name` varchar(765),
`file_remark` varchar(765),
`file_disc_name` varchar(500),
`file_size` bigint,
`hash` varchar(65),
`task_id` bigint,
`items_id` bigint NOT NULL,
`create_date` datetime,
`status` int DEFAULT 1,
`slot_id` int NOT NULL,
`content_type` varchar(65) DEFAULT NULL,
`storage_class` tinyint DEFAULT 0,
`thumbs` tinyint DEFAULT 0,
`meta_data` varchar(1000),
PRIMARY KEY (`id`,`slot_id`),
KEY `index_folder_id` (`folder_id`) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
");
    PREPARE filestmt FROM @creat_sql;
    EXECUTE filestmt;
    DEALLOCATE PREPARE filestmt;
  ELSEIF tableType = 'tbl_task_file' THEN
    SET @creat_sql = CONCAT("
CREATE TABLE IF NOT EXISTS `tbl_task_file_",tableId,"` (
`id` bigint NOT NULL,
`uuid` varchar(64),
`folder_id` bigint NOT NULL,
`file_name` varchar(765),
`file_remark` varchar(765),
`file_disc_name` varchar(500),
`file_size` bigint,
`hash` varchar(65),
`task_id` bigint,
`items_id` bigint NOT NULL,
`create_date` datetime,
`status` int DEFAULT 1,
`slot_id` int NOT NULL,
`content_type` varchar(65) DEFAULT NULL,
`storage_class` tinyint DEFAULT 0,
`thumbs` tinyint DEFAULT 0,
`meta_data` varchar(1000),
`volume_id` int NOT NULL,
PRIMARY KEY (`id`,`volume_id`),
KEY `index_folder_id` (`folder_id`) USING BTREE,
KEY `index_volume_id` (`volume_id`) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
");
    PREPARE filestmt FROM @creat_sql;
    EXECUTE filestmt;
    DEALLOCATE PREPARE filestmt;
  ELSEIF tableType = 'tbl_file' THEN
    IF markId = 0 THEN
      SET @idStr = "`id` bigint NOT NULL AUTO_INCREMENT,";
    ELSEIF markId = 1 THEN
      SET @idStr = "`id` bigint NOT NULL,";
    END IF;
    SET @creat_sql = CONCAT("
CREATE TABLE IF NOT EXISTS `tbl_file_",tableId,"` (
",@idStr,"
`uuid` varchar(64),
`folder_id` bigint NOT NULL,
`file_name` varchar(765),
`file_remark` varchar(765),
`file_disc_name` varchar(500),
`file_size` bigint,
`hash` varchar(65),
`hash1` varchar(65),
`task_id` bigint,
`items_id` bigint NOT NULL,
`create_date` datetime,
`status` tinyint DEFAULT 1,
`burn_times` tinyint DEFAULT 1,
`slot_id` int,
`content_type` varchar(65) DEFAULT NULL,
`storage_class` tinyint DEFAULT 0,
`thumbs` tinyint DEFAULT 0,
`meta_data` varchar(1000),
PRIMARY KEY (`id`),
KEY `index_folder_id` (`folder_id`) USING BTREE,
KEY `index_slot_id` (`slot_id`) USING BTREE,
KEY `index_items_id` (`items_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=",maxFileId," CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
");
    PREPARE filestmt FROM @creat_sql;
    EXECUTE filestmt;
    DEALLOCATE PREPARE filestmt;
  ELSEIF tableType = 'tbl_slot_folder' THEN
    /*创建目录表*/
    SET @creat_sql = CONCAT("
CREATE TABLE IF NOT EXISTS `tbl_slot_folder_",tableId,"` (
`id` bigint NOT NULL,
`name` varchar(1000) NOT NULL,
`folder_path` varchar(4096) DEFAULT '',
`disc_path` varchar(4096) DEFAULT '',
`s_level` int DEFAULT 0,
`parent` bigint DEFAULT 0,
`sum_files` bigint,
`files` int DEFAULT 0,
`subs` int DEFAULT 0,
`slot_id` int NOT NULL,
PRIMARY KEY (`id`,`slot_id`),
KEY `index_parent` (`parent`) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
");
    PREPARE folstmt FROM @creat_sql;
    EXECUTE folstmt;
    DEALLOCATE PREPARE folstmt; 
  ELSEIF tableType = 'tbl_task_folder' THEN
    SET @creat_sql = CONCAT("
CREATE TABLE IF NOT EXISTS `tbl_task_folder_",tableId,"` (
`id` bigint NOT NULL,
`name` varchar(1000) NOT NULL,
`folder_path` varchar(4096) DEFAULT '',
`disc_path` varchar(4096) DEFAULT '',
`s_level` int DEFAULT 0,
`parent` bigint DEFAULT 0,
`sum_files` bigint,
`files` int DEFAULT 0,
`subs` int DEFAULT 0,
`volume_id` int NOT NULL,
PRIMARY KEY (`id`,`volume_id`),
KEY `index_parent` (`parent`) USING BTREE,
KEY `index_volume_id` (`volume_id`) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
");
    PREPARE folstmt FROM @creat_sql;
    EXECUTE folstmt;
    DEALLOCATE PREPARE folstmt; 
  ELSEIF tableType = 'tbl_folder'   THEN
    SET @creat_sql = CONCAT("
CREATE TABLE IF NOT EXISTS `tbl_folder_",tableId,"` (
`id` bigint NOT NULL AUTO_INCREMENT,
`name` varchar(1000) NOT NULL,
`folder_path` varchar(4096) DEFAULT '',
`disc_path` varchar(4096) DEFAULT '',
`s_level` int DEFAULT 0,
`parent` bigint DEFAULT 0,
`sum_files` bigint,
`files` int DEFAULT 0,
`subs` int DEFAULT 0,
PRIMARY KEY (`id`),
KEY `index_parent` (`parent`) USING BTREE
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
");
    PREPARE folstmt FROM @creat_sql;
    EXECUTE folstmt;
    DEALLOCATE PREPARE folstmt; 
  ELSEIF tableType = 'tbl_file_path_temp'   THEN
    SET @creat_sql = CONCAT("
CREATE TABLE IF NOT EXISTS `tbl_file_path_temp_",tableId,"` (
`id` bigint(20) NOT NULL AUTO_INCREMENT,    
`app_uuid` varchar(64),
`volume_id` int(11),
`file_id` bigint(20),
`folder_id` bigint(20),
`cache_path` varchar(1024),
`file_size` bigint(20),
`file_md5` char(32),
`check_status` int(4) DEFAULT 0,
`type` int(4) DEFAULT 0,
`slot_id` int(11),
PRIMARY KEY (`id`),
UNIQUE KEY `idx_uuid` (`app_uuid`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
");
    PREPARE folstmt FROM @creat_sql;
    EXECUTE folstmt;
    DEALLOCATE PREPARE folstmt; 
  ELSEIF tableType = 'tbl_certif_record' THEN
        SET @creat_sql = CONCAT("CREATE TABLE IF NOT EXISTS tbl_certif_record_",tableId,"_",maxFileId," (
`id` bigint NOT NULL AUTO_INCREMENT,
`uuid` varchar(64),
`user_id` int DEFAULT NULL,
`task_id` bigint DEFAULT NULL,
`file_id` bigint DEFAULT NULL,
`type` int DEFAULT NULL,
`file_name` text DEFAULT NULL,
`file_size` bigint DEFAULT NULL,
`stage` int DEFAULT NULL,
`hash` text DEFAULT NULL,
`certif_platform_id` int DEFAULT NULL,
`create_date` datetime DEFAULT NULL,
`update_date` datetime DEFAULT NULL,
`req_data` text DEFAULT NULL,
`res_data` text DEFAULT NULL,
`meta_data` text DEFAULT NULL,
`status` int DEFAULT NULL,
`is_delete` int DEFAULT NULL,
`cmt` text DEFAULT NULL,
PRIMARY KEY (`id`),
UNIQUE KEY `idx_file_id` (`file_id`)
) ENGINE=InnoDB CHARACTER SET=utf8mb4 COLLATE utf8mb4_general_ci;
");
	PREPARE folstmt FROM @creat_sql;
    EXECUTE folstmt;
    DEALLOCATE PREPARE folstmt; 
  END IF;
  COMMIT;

END;
;;
DELIMITER ;
