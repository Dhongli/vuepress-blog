---
title: Linux 磁盘与文件系统管理
cover: /assets/images/cover2.jpg
icon: pen-to-square
date: 2022-01-12
category:
  - 蔬菜
tag:
  - 红
  - 圆
star: true
sticky: 1
---

# 硬盘接口

常见的硬盘接口有：**IDE** 、**SATA**、**SAS**、**USB**、**SCSI**，其中 SATA 是目前的主流接口，IDE 则几乎不再使用。

![](/assets/images/Linux%20磁盘与文件系统管理-硬盘接口.png)

# 设备文件

计算机的各种硬件设备在 Linux 中都有对应的设备文件，甚至不同的接口也对应着不同的设备文件，从而使用不同的驱动程序来操作硬件设备。对于硬盘，实体设备的文件名一般是 `/dev/sd[a-]`；虚拟设备（虚拟机中的硬盘）的文件名一般是 `/dev/vd[a-]`。

有时，系统中会有 `/dev/sda`、`/dev/sdb`...等设备文件，它们之间又是什么关系呢？实际上，`/dev/sd[a-]` 是 SATA/USB/SAS 等硬盘接口对应的设备文件，这类接口都使用 SCSI 模块作为驱动程序。`a`、`b`、`c`...则是按系统检测到的顺序来排列的，与实际插槽顺序无关。

我们知道硬盘是可以被分区成多个分区（partition），如在 Windows 中可以将一块硬盘分区成 `C:`、`D:`、`E:` 盘。那么，不同的分区是否也有对应的设备文件呢？

# 硬盘结构

提到分区，我们需要先了解一下硬盘的结构。不同寻址方式的硬盘，其结构也不同。硬盘的寻址方式主要有两种：

- **CHS 寻址方式**：由柱面数（Cylinders）、磁头数（Headers）、扇区数（Sectors）组成 3D 参数，简称 CHS 寻址方式，硬盘容量相对较小。如传统的机械硬盘（Hard Disk Drive，HDD）。
- **LBA 寻址方式**：线性寻址，以逻辑区块为单位进行寻址，全称为 Logic Block Address（即扇区的逻辑块地址），硬盘容量相对较大。如固态硬盘（Solid State Disk，SSD）

## CHS 寻址方式

如下图所为 CHS 寻址方式的硬盘结构，硬盘主要由盘片、机械手臂、磁头、主轴马达组成。盘片是数据存储的媒介，圆形，通过机械手臂读写数据，盘片需要转动才能够让机械手臂读写。因此，可以将盘片同心圆分割成一个个的小区块，这些区块组成一个圆形，可以让机械手臂的磁头进行读写。这个小区块就是硬盘的最小物理存储单位，即 **扇区（sector）**。位于同一个同心圆上的扇区组成的圆环，即 **磁道（track）**。硬盘中可能包含多个盘片，在所有盘片上的同一个磁道组成了所谓的 **柱面（cylinder）**，柱面是文件系统的最小单位，也是分区的最小单位。
![](/assets/images/Linux%20磁盘与文件系统管理-chs寻址方式.png)

## LBA 寻址方式

LBA 寻址方式的硬盘使用集成电路代替物理旋转磁盘，主要由主控与闪存芯片组成。数据的读写速度远远高于 CHS 寻址方式的硬盘。

# 硬盘分区

了解了硬盘结构，再来看硬盘分区。

关于硬盘分区，首先思考一个问题：为什么要分区？其实主要有两个原因：

1. 数据的安全性。由于每个分区的数据是独立的，使得数据更加安全。
2. 访存的高效性。对于 CHS 寻址方式的硬盘，由于分区将数据集中在某个柱面的区段，如第一个分区位于柱面号 1~100。当需要对该分区进行访存时，硬盘只会在 1~100 柱面范围内进行操作，从而提升了数据的访存性能。

既然硬盘能被分区，那么其分区信息是如何保存的呢？答案就是分区表。但是对于不同寻址方式的硬盘，其分区表的格式也不同，主要有两种：

- **MBR 分区表**：多用于 CHS 寻址方式的硬盘
- **GUID 分区表**：多用于 LBA 寻址方式的硬盘

分区表有存储在哪里呢？和绝大多数文件将自身的基本描述信息放在文件的开头类似，分区表作为硬盘的基本信息，同样保存在硬盘最前面的存储区域。

下面分别介绍 MBR 分区表和 GUID 分区表。

## **MBR 分区表**

MBR 分区表保存在硬盘的 **第一个扇区**，由于第一个扇区主要记录了两个重要信息，也称为 **主引导记录区（Master Boot Record，MBR）**。这两个信息分别是：

- **MBR 分区表**：记录整个硬盘的分区信息，容量为 64 Bytes。
- **引导程序（Boot Loader）**：容量为 446 Bytes。

### MBR 分区表

分区表占据了 MBR 64 Bytes 的空间，最多只能记录 4 组分区信息，每组分区信息记录了该分区的 **起始与结束的柱面号**，这 4 组分区信息称为 **主要分区（primary partition）** 或 **延伸分区（extended partition）**。

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/disk-partition-table.png?x-oss-process=image/resize,w_800)

假设上述硬盘的设备文件名为 `/dev/sda`，则这四个分区在 Linux 中的设备文件名如下所示，重点在于文件名后面会再接一个数字，这个数字与分区在硬盘中的位置有关。

- P1：`/dev/sda1`
- P2：`/dev/sda2`
- P3：`/dev/sda3`
- P4：`/dev/sda4`

由于分区表只有 64 Bytes，最多只能记录 4 组分区信息，那么是否意味着一个硬盘最多只能分割成 4 个分区呢？当然不是！**虽然第一个扇区的分区表只能记录 4 组分区信息，但是利用其中的延伸分区信息进一步索引到一个新的分区表，从而记录更多分区信息**。如下图所示：

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/disk-partition-table-extend.png?x-oss-process=image/resize,w_800)

上图所示，硬盘第一个扇区中的四个分区记录仅仅使用了两个，P1 为 **主要分区**，P2 为 **延伸分区**。延伸分区的目的是使用额外的扇区来记录分区信息。通过延伸分区所指向的那个区块继续记录分区信息。上图延伸分区索引的分区表继续分出了 5 个分区，这 5 个有延伸分区分出来的分区，称为 **逻辑分区（logical partition）**。

同理，上图中的分区在 Linux 中的设备文件名如下所示。其中的 `/dev/sda3` 和 `/dev/sda4` 则保留给主要分区和延伸分区了，所以逻辑分区的设备文件名从 5 开始。

- P1：`/dev/sda1`
- P2：`/dev/sda2`
- L1：`/dev/sda5`
- L2：`/dev/sda6`
- L3：`/dev/sda7`
- L4：`/dev/sda8`
- L5：`/dev/sda9`

> MBR 主要分区、延伸分区、逻辑分区的特性 - 主要分区与延伸分区最多可以有 4 个（硬盘的限制） - 延伸分区最多只有一个（操作系统的限制） - 逻辑分区是由延伸分区持续分割出来的分区 - 主要分区和逻辑分区可以被格式化；延伸分区不能被格式化 - 逻辑分区的数量上限由操作系统决定

### 引导程序（Boot Loader）

Boot loader 是操作系统安装在 MBR 中的一套软件，但 MRB 仅仅提供 446 Bytes 的空间给 boot loader，所以 boot loader 是极其精简的。其主要完成以下任务：

1. 提供菜单：用户可以选择不同的开机项目
2. 载入核心文件：直接指向可开机的程序区段来启动操作系统
3. 转交其他 loader：将开机管理功能转交给其他 loader 负责，主要用于多系统引导。

对于第 3 项，表示计算机系统中可能具有两个以上的 boot loader。事实上，boot loader 不仅可以安装在 MBR 中，还可以安装在每个分区的 **开机扇区（boot sector）** 中。

假设 MBR 中安装的是可以识别 Windows/Linux 的 boot loader，那么整个流程如下图所示：

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/disk-boot-loader.png?x-oss-process=image/resize,w_800)

由上图可知，MBR 的 boot loader 提供两个菜单选项：选项 1（M1）可以直接载入 Windows 的核心文件进行开机；选项二（M2）可以将开机管理任务交给第二个分区的开机扇区（boot sector）。如果用户选择选项 2，第二分区的开机扇区中的 boot loader 将会载入 Linux 的核心文件进行开机。

> 关于多系统安装 Linux 安装时，可以将 boot loader 安装在 MBR 或其他分区的开机扇区，Linux 的 boot loader 可以手动设置菜单（即上图的 M1、M2），因此可在 Linux 的 boot loader 中加入 Windows 开机的选项 Windows 安装时，其安装程序会主动覆盖 MBR 以及自己所在分区的开机扇区，并且没有选择的机会，也没有让用户自己选择的菜单的功能 结论：安装多系统时应该先安装 Windows 系统

## GUID 分区表

MBR 主要有以下限制：

- 操作系统无法寻址容量超过 2.2TB 的磁盘
- MBR 只有一个区块，若被破坏后，很难对数据进行恢复
- MBR 的引导程序所能使用空间只有 446 Byte，无法容纳更多的代码

GUID 则解决了 MBR 的这些问题。

下图所示为 GUID 的结构示意图。与 MBR 使用扇区作为寻址单位不同，GUID 使用 **逻辑区块（Logical Block）** 作为寻址单位，即采用 LBA（Logical Block Address）寻址方式。MRB 仅使用第一个扇区 512 Bytes 的空间记录分区信息，GUID 则使用 34 个 LBA 区块（每个区块容量默认为 512 Bytes）记录分区信息。MBR 仅有一个扇区保存分区信息，GUID 除了使用硬盘前 34 个 LBA，还是用最后 33 个 LBA 作为备份。

这里有个疑问：为何前面使用 34 个 LBA，后面使用 33 个 LBA。因为第一个 LBA（LBA0）是用来兼容 MBR 的。

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/disk-guid-partition-table.png?x-oss-process=image/resize,w_800)

### LBA0（MBR 兼容区块）

LBA0 为了兼容 MBR，该区块也分为两个部分，分别用于存储 MBR 分区表和引导程序。因为LBA0 是针对 MBR 兼容模式，因此其分区表中仅仅存放一个特殊标志的分区表信息，用来标识此硬盘为 LBA 寻址方式。

### LBA1（GUID 分区表表头）

LBA1 记录了分区表本身的位置和大小，同时记录了备份分区表的位置（即最后 33 个 LBA）。此外还存放了分区表的校验码（CRC32），表示硬盘的完整性。

### LBA2~33（分区表表项）

从 LBA2 开始，每个 LBA 都可以记录 4 组分区信息。默认情况下，总共可以有 4 * 32 = 128 组分区信息。因为每个 LBA 有 512 Bytes，所以每组分区信息可使用 128 Bytes 的空间。这 128 Bytes 的分区信息中，分别提供了 64 Bits 用于记录分区对应的 **起始/结束** 区块号。因此，GUID 能够支持的硬盘的最大容量为 `2^64 * 512Byte = 233 TB`


# 硬盘格式化

我们知道，一个硬盘必须要经过格式化之后才能使用。那么，格式化到底做了什么呢？

本质上，硬盘格式化可以分为两个步骤，分别是：

- **低级格式化**，或称 **物理格式化**。
- **高级格式化**，或称 **逻辑格式化**。

## 低级格式化

在 [《计算机那些事(1)——硬盘》](http://chuquan.me/2019/04/05/linux-disk-introduce/) 一文中，我们介绍了硬盘的两种寻址方式，分别是：

- **CHS 寻址方式**：由柱面数（Cylinders）、磁头数（Headers）、扇区数（Sectors）组成 3D 参数，简称 CHS 寻址方式，硬盘容量相对较小。如传统的机械硬盘（Hard Disk Drive，HDD）。
- **LBA 寻址方式**：线性寻址，以逻辑区块为单位进行寻址，全称为 Logic Block Address（即扇区的逻辑块地址），硬盘容量相对较大。如固态硬盘（Solid State Disk，SSD）

对于 CHS 硬盘，低级格式化会对硬盘进行划分柱面、磁道、扇区的操作，也称为 **扇区初始化**。一般由硬盘制造商进行低级格式化。

对于 LBA 硬盘，并不存在低级格式化，因为 LBA 寻址的硬盘使用集成电路替代物理旋转磁盘，主要由主控和闪存芯片组成。

低级格式化完成后，硬盘控制器即可使用格式化的结果。

## 高级格式化

相对而言，低级格式化是在硬件层面进行初始化，而高级格式化则是在软件层面进行初始化。

高级格式化一般会有两个步骤：

- **硬盘分区初始化**：在硬盘的特定区域写入特定的数据，即重写分区表。关于硬盘分区的细节，可以阅读 [《计算机那些事(1)——硬盘》](http://chuquan.me/2019/04/05/linux-disk-introduce/)。
- **文件系统初始化**：根据用户选定的文件系统（如：FAT、NTFS、EXT2、EXT3 等），在特定分区中规划一系列表结构进行逻辑区块管理等。

通常，一个硬盘可以被划分为多个分区。传统的硬盘，每个分区只能初始化一种文件系统。现代的 LVM 与 RAID 技术则能够支持将一个分区格式化为多个文件系统，也支持将多个分区合并成一个文件系统。

## 软硬件映射

在硬件层面，对于 CHS 硬盘，最小的物理存储单元是扇区，大小为 512 byte；对于 LBA 硬盘，最小的物理存储单元是闪存（本质是晶体管），大小为 1 bit。

在软件层面，为了与操作系统的页大小对齐，文件系统定义的逻辑区块大小一般为 1K、2K 或 4K。

下图所示，为文件系统逻辑区块与硬盘物理区块之间的映射关系。对于 CHS 硬盘，一个逻辑区块所对应的物理区块可能由多个扇区组成。对于 LBA 硬盘，一个逻辑区块则对应一片集成电路存储单元。

在通信时，首先由文件系统的 I/O 管理器将逻辑区块转换成物理区块地址，然后由硬盘控制器根据物理区块（扇区）地址，进行数据读写。

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/filesystem-map.png?x-oss-process=image/resize,w_800)

# 文件系统类型

常见的文件系统类型非常多，比如：

- CentOS 5/6 默认使用 ext2/ext3/ext4
- CentOS 7 默认使用 xfs
- Windows 默认使用 NTFS
- MacOS、iOS、watchOS 默认使用 APFS（曾经使用 HFS）

虽然文件系统的种类很多，但是它们的底层实现大同小异。本文，我们来聊一聊 Linux 系统下的默认文件系统——Ext 文件系统族，举一反三，从而来理解文件系统的底层设计。

# 文件系统结构

以 Linux 经典的 Ext2 文件系统进行分析，其整体结构如下图所示。

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/filesystem-arch-01.png?x-oss-process=image/resize,w_800)

从宏观角度来看，文件系统将硬盘分为两部分：

- **引导区块（Boot Block）**
- **区块组（Block Groups）**

## Boot Block

引导区块是分区的第一个区块，当然，并不是所有分区都有引导区块，只有安装了操作系统的主分区和逻辑分区才有引导区块。

引导区块存储了 Boot Loader，当系统加电启动时，Boot Loader 会被引导装载并执行，从而最终启动操作系统。

## Block Groups

文件系统的另一主要组成是区块组，ext2 文件系统包含多个区块组，那么为什么要划分那么多区块组呢？事实上，如果直接管理逻辑区块，逻辑区块的数量是非常庞大的，难以管理，因此为了简化，划分出了区块组，从而进行分级管理。

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/filesystem-arch-02.png?x-oss-process=image/resize,w_800)

上图所示，区块组内部又可以分成多个部分，分别是：

- **超级区块（Super Block）**
- **组描述符表（Group Descriptor Table，GDT）**
- **区块位图（Block Bitmap）**
- **索引节点位图（Inode Bitmap）**
- **索引节点表（Inode Table）**
- **数据区块（Data Blocks）**

> 注意  
> **区块组的 “区块” 对应的文件系统的逻辑区块。区块组中的各个组成部分都使用 “区块” 作为载体进行存储**。

下面，我们将分别介绍区块组的各个组成部分。

# Block & Inode

在介绍区块组的各个组成部分之前，我们先来了解一下 Block 和 Inode。

## Block

Block 主要用于 **存储文件的内容数据**。不同大小的 Block 使得文件系统能够支持的最大容量和最大单一文件大小各不相同，其限制如下所示：

|Block size|1KB|2KB|4KB|
|---|---|---|---|
|最大单一文件限制|16GB|256GB|2TB|
|最大文件系统容量|2TB|8TB|16TB|

Block 有一些基本限制，如下：

- Block 的大小和数量在格式化后无法改变。
- 一个 Block 只能存放一个文件的数据。
- 如果文件大于 Block 的大小，则一个文件会占用多个 Block。
- 如果文件小于 Block 的大小，则 Block 中多余的容量将无法再被使用。

## Inode

上述，我们提到了一个大文件会占用多个 Block，那么，文件系统是如何判断哪些 Block 是属于同一个文件的呢？答案就是索引节点（index node，inode）。

Inode 主要用于 **存储文件的属性元数据**，其记录的信息包括：

- 文件的类型
- 文件的权限：read/write/execute
- 文件的拥有者：owner
- 文件的群组：group
- 文件的容量
- 文件的创建时间：ctime
- 文件的最近读取时间：atime
- 文件的最近修改时间：mtime
- 文件的内容指针：**即指向属于文件的 Block 的指针**
- ...

> 注意  
> Inode 并不包含文件名，文件名则存储在 **目录项** 中，详细信息可见下文。

根据 inode 中存储的文件内容指针，文件系统就能找到哪些 Block 是属于该文件的。

在高级格式化时，inode 的数量和大小就已经固定下来了，其大小一般为 128 byte 或 256 byte。同样，inode 也有一些基本限制，如下：

- 一个文件只会占用一个 inode。
- 文件系统支持的最大文件数量与 inode 的相关。
- 文件系统读取文件时，判断对应 inode 的权限与使用者是否符合，如果符合才能读取 Block 的数据。

如下所示为 ext2 中 inode 的数据结构定义。**注意，inode 的定义并没有 inode id，那么这种情况下如何索引 inode 呢**？关于这个问题，我们在 Inode Table 一节进行解释。

|   |   |
|---|---|
|1  <br>2  <br>3  <br>4  <br>5  <br>6  <br>7  <br>8  <br>9  <br>10  <br>11  <br>12  <br>13  <br>14  <br>15  <br>16  <br>17  <br>18  <br>19  <br>20  <br>21  <br>22  <br>23  <br>24  <br>25  <br>26  <br>27  <br>28  <br>29  <br>30  <br>31  <br>32  <br>33  <br>34  <br>35  <br>36  <br>37  <br>38  <br>39  <br>40  <br>41  <br>42  <br>43  <br>44  <br>45  <br>46  <br>47  <br>48  <br>49  <br>50  <br>51  <br>52  <br>53  <br>54|/* linux/fs/ext2/ext2.h */  <br>struct ext2_inode {  <br>	__le16	i_mode;		            /* File mode */  <br>	__le16	i_uid;	            	/* Low 16 bits of Owner Uid */  <br>	__le32	i_size;		            /* Size in bytes */  <br>	__le32	i_atime;	            /* Access time */  <br>	__le32	i_ctime;	            /* Creation time */  <br>	__le32	i_mtime;	            /* Modification time */  <br>	__le32	i_dtime;	            /* Deletion Time */  <br>	__le16	i_gid;		            /* Low 16 bits of Group Id */  <br>	__le16	i_links_count;	        /* Links count */  <br>	__le32	i_blocks;	            /* Blocks count */  <br>	__le32	i_flags;	            /* File flags */  <br>	union {  <br>		struct {  <br>			__le32  l_i_reserved1;  <br>		} linux1;  <br>		struct {  <br>			__le32  h_i_translator;  <br>		} hurd1;  <br>		struct {  <br>			__le32  m_i_reserved1;  <br>		} masix1;  <br>	} osd1;				            /* OS dependent 1 */  <br>	__le32	i_block[EXT2_N_BLOCKS]; /* Pointers to blocks */  <br>	__le32	i_generation;	        /* File version (for NFS) */  <br>	__le32	i_file_acl;	            /* File ACL */  <br>	__le32	i_dir_acl;	            /* Directory ACL */  <br>	__le32	i_faddr;	            /* Fragment address */  <br>	union {  <br>		struct {  <br>			__u8	l_i_frag;	    /* Fragment number */  <br>			__u8	l_i_fsize;	    /* Fragment size */  <br>			__u16	i_pad1;  <br>			__le16	l_i_uid_high;	/* these 2 fields    */  <br>			__le16	l_i_gid_high;	/* were reserved2[0] */  <br>			__u32	l_i_reserved2;  <br>		} linux2;  <br>		struct {  <br>			__u8	h_i_frag;	    /* Fragment number */  <br>			__u8	h_i_fsize;	    /* Fragment size */  <br>			__le16	h_i_mode_high;  <br>			__le16	h_i_uid_high;  <br>			__le16	h_i_gid_high;  <br>			__le32	h_i_author;  <br>		} hurd2;  <br>		struct {  <br>			__u8	m_i_frag;	    /* Fragment number */  <br>			__u8	m_i_fsize;	    /* Fragment size */  <br>			__u16	m_pad1;  <br>			__u32	m_i_reserved2[2];  <br>		} masix2;  <br>	} osd2;				            /* OS dependent 2 */  <br>};|

### 文件系统预留 Inode

Ext 文件系统预留了一部分 Inode 作为特殊用途，如下所示。

|Inode|用途|
|---|---|
|0|不存在，可用于标识目录的 Data Block 中已删除的文件|
|1|虚拟文件系统，如：`/proc`、`/sys`|
|2 |根目录EXT家族为2，XFS为128 |
|3|ACL 索引|
|4|ACL 数据|
|5|Boot Loader|
|6|未删除的目录|
|7|预留的区块组描述符 Inode|
|8|日志 Inode|
|11|第一个非预留的 Inode，通常是 `lost+fount` 目录|

# 区块组结构

## Data Blocks

Data Blocks 包含了区块组中剩余的所有 Block。Block 的数量在高级格式化完成后就已经确定下来了。

## Block Bitmap(区块对照表)

Block Bitmap 用于标识区块组中所有的 Block 的使用状态，其使用 1 bit 来表示：0 表示空闲，1 表示占用。

区块组使用一个 Block 存储 Block Bitmap。如果 Block 的大小为 4K，那么其总共有 4 x 1024 x 8 = 32768 个比特位，可用于描述可使用的 Block。

注意，Block Bitmap 只在写数据时使用，因为只有写数据才需要找到空闲的 Block。

## Inode Table

Inode Table 包含了区块组中所有的 Inode。Inode 的数量在高级格式化完成后就已经确定下来了。

如果 Block 的大小为 4K 且 inode 的大小为 256 byte，那么一个 Block 可以存储 4 x 1024 / 256 = 16 个 inode。区块组中的 Inode Table 通过占用了多个连续的 Block，在逻辑上形成一张表记录了所有 inode，如下图所示。

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/filesystem-arch-03.png?x-oss-process=image/resize,w_800)

根据上述原理，当给定一个 inode id 时，我们只需要结合 inode 数据结构的大小，在这个 Inode Table 中查找到对应项即可找到对应的 inode。这也就解释了为什么 inode 没有 inode id 也能找到 inode 的原因。

![](/assets/images/Linux%20磁盘与文件系统管理-inode结构示意图.png)
上图最左边为 inode 本身 (128 bytes)，里面有 12 个直接指向 block 号码的对照，这 12 笔记录就能够直接取得 block 号码啦！ 至于所谓的间接就是再拿一个 block 来当作记录 block 号码的记录区，如果文件太大时， 就会使用间接的 block 来记录编号。如上图 1.3.2 当中间接只是拿一个 block 来记录额外的号码而已。 同理，如果文件持续长大，那么就会利用所谓的双间接，第一个 block 仅再指出下一个记录编号的 block 在哪里， 实际记录的在第二个 block 当中。依此类推，三间接就是利用第三层 block 来记录编号啦！
这样子 inode 能够指定多少个 block 呢？我们以较小的 1K block 来说明好了，可以指定的情况如下：

- 12 个直接指向： 12\*1K=12K  
    由于是直接指向，所以总共可记录 12 笔记录，因此总额大小为如上所示；  
- 间接： 256\*1K=256K  
    每笔 block 号码的记录会花去 4bytes，因此 1K 的大小能够记录 256 笔记录，因此一个间接可以记录的文件大小如上；  
- 双间接： 256\*256\*1K=2562K  
    第一层 block 会指定 256 个第二层，每个第二层可以指定 256 个号码，因此总额大小如上；  
- 三间接： 256\*256\*256\*1K=2563K  
    第一层 block 会指定 256 个第二层，每个第二层可以指定 256 个第三层，每个第三层可以指定 256 个号码，因此总额大小如上；  
- 总额：将直接、间接、双间接、三间接加总，得到 12 + 256 + 256\*256 + 256\*256*256 (K) = 16GB

## Inode Bitmap

Inode Bitmap 用于标识区块组中所有的 inode 的使用状态，其使用 1 bit 来表示：0 表示空闲，1 表示占用。

区块组使用一个 Block 存储 Inode Bitmap。如果 Block 的大小为 4K，那么其总共有 4 x 1024 x 8 = 32768 个比特位，可用于描述可使用的 inode。

## Filesystem Description ( GDT文件系统描述说明)

这个区段可以描述每个 block group 的开始与结束的 block 号码，以及说明每个区段 (superblock, bitmap, inodemap, data block) 分别介于哪一个 block 号码之间。这部份也能够用 [dumpe2fs](http://cn.linux.vbird.org/linux_basic/0230filesystem.php#dumpe2fs) 来观察的。

```c
/* linux/fs/ext2/ext2.h */  
struct ext2_group_desc {  
	__le32	bg_block_bitmap;		/* Blocks bitmap block */  
	__le32	bg_inode_bitmap;		/* Inodes bitmap block */  
	__le32	bg_inode_table;		    /* Inodes table block */  
	__le16	bg_free_blocks_count;	/* Free blocks count */  
	__le16	bg_free_inodes_count;	/* Free inodes count */  
	__le16	bg_used_dirs_count;	    /* Directories count */  
	__le16	bg_pad;  
	__le32	bg_reserved[3];  
};
```


区块组使用连续的 Block 记录了文件系统中所有区块组的组描述符，从而在逻辑上形成一张表，即 Group Descriptor Table（简称 GDT），如下图所示。

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/filesystem-arch-04.png?x-oss-process=image/resize,w_800)

这里会有一个疑问，为什么区块组中存储了一个描述整个文件系统区块组的信息？很多区块组都存储了内容重复的 GDT，这样是否会造成存储空间的浪费？其实这么做的原因是为了进行 **备份**，如果只在某片区域存储这部分信息，一旦这片存储区域出现了损坏，那么将导致整个文件系统无法使用并且无法恢复。

## Super Block

类似于 GDT，Super Block 也是一个描述文件系统整体的数据结构，其存储在区块组中也是为了备份。

**Super Block 是文件系统的核心**，其保存了 **文件系统的所有元数据**，比如：

- Block 和 Inode 的总量
- 空闲/占用的 Block 和 Inode 的数量
- Block 和 Inode 的大小
- 文件系统的挂载时间
- 文件系统的最近写入时间
- 一个 valid bit 数值，若此文件系统已被挂载，则 valid bit 为 0 ，若未被挂载，则 valid bit 为 1 。
- ...

>每个区块组（block group）都可能含有超级区块。除了第一个block group 内会含有 superblock 之外，后续的 block group 不一定含有 superblock ， 而若含有 superblock 则该 superblock 主要是做为第一个 block group 内 superblock 的备份，这样可以进行超级区块的恢复。

如下所示为 ext2 中 Super Block 的数据结构定义。

```c
/* linux/fs/ext2/ext2.h */  
struct ext2_super_block {  
	__le32	s_inodes_count;		                /* Inodes count */  
	__le32	s_blocks_count;		                /* Blocks count */  
	__le32	s_r_blocks_count;	                /* Reserved blocks count */  
	__le32	s_free_blocks_count;	            /* Free blocks count */  
	__le32	s_free_inodes_count;	            /* Free inodes count */  
	__le32	s_first_data_block;	                /* First Data Block */  
	__le32	s_log_block_size;	                /* Block size */  
	__le32	s_log_frag_size;	                /* Fragment size */  
	__le32	s_blocks_per_group;	                /* # Blocks per group */  
	__le32	s_frags_per_group;	                /* # Fragments per group */  
	__le32	s_inodes_per_group;	                /* # Inodes per group */  
	__le32	s_mtime;		                    /* Mount time */  
	__le32	s_wtime;		                    /* Write time */  
	__le16	s_mnt_count;		                /* Mount count */  
	__le16	s_max_mnt_count;	                /* Maximal mount count */  
	__le16	s_magic;		                    /* Magic signature */  
	__le16	s_state;		                    /* File system state */  
	__le16	s_errors;		                    /* Behaviour when detecting errors */  
	__le16	s_minor_rev_level; 	                /* minor revision level */  
	__le32	s_lastcheck;		                /* time of last check */  
	__le32	s_checkinterval;	                /* max. time between checks */  
	__le32	s_creator_os;		                /* OS */  
	__le32	s_rev_level;		                /* Revision level */  
	__le16	s_def_resuid;		                /* Default uid for reserved blocks */  
	__le16	s_def_resgid;		                /* Default gid for reserved blocks */  
	/*  
	 * These fields are for EXT2_DYNAMIC_REV superblocks only.  
	 *  
	 * Note: the difference between the compatible feature set and  
	 * the incompatible feature set is that if there is a bit set  
	 * in the incompatible feature set that the kernel doesn't  
	 * know about, it should refuse to mount the filesystem.  
	 *   
	 * e2fsck's requirements are more strict; if it doesn't know  
	 * about a feature in either the compatible or incompatible  
	 * feature set, it must abort and not try to meddle with  
	 * things it doesn't understand...  
	 */  
	__le32	s_first_ino; 		                /* First non-reserved inode */  
	__le16  s_inode_size; 		                /* size of inode structure */  
	__le16	s_block_group_nr; 	                /* block group # of this superblock */  
	__le32	s_feature_compat; 	                /* compatible feature set */  
	__le32	s_feature_incompat; 	            /* incompatible feature set */  
	__le32	s_feature_ro_compat; 	            /* readonly-compatible feature set */  
	__u8	s_uuid[16];		                    /* 128-bit uuid for volume */  
	char	s_volume_name[16]; 	                /* volume name */  
	char	s_last_mounted[64]; 	            /* directory where last mounted */  
	__le32	s_algorithm_usage_bitmap;           /* For compression */  
	/*  
	 * Performance hints.  Directory preallocation should only  
	 * happen if the EXT2_COMPAT_PREALLOC flag is on.  
	 */  
	__u8	s_prealloc_blocks;	                /* Nr of blocks to try to preallocate*/  
	__u8	s_prealloc_dir_blocks;	            /* Nr to preallocate for dirs */  
	__u16	s_padding1;  
	/*  
	 * Journaling support valid if EXT3_FEATURE_COMPAT_HAS_JOURNAL set.  
	 */  
	__u8	s_journal_uuid[16];	                /* uuid of journal superblock */  
	__u32	s_journal_inum;		                /* inode number of journal file */  
	__u32	s_journal_dev;		                /* device number of journal file */  
	__u32	s_last_orphan;		                /* start of list of inodes to delete */  
	__u32	s_hash_seed[4];		                /* HTREE hash seed */  
	__u8	s_def_hash_version;	                /* Default hash version to use */  
	__u8	s_reserved_char_pad;  
	__u16	s_reserved_word_pad;  
	__le32	s_default_mount_opts;  
 	__le32	s_first_meta_bg; 	                /* First metablock block group */  
	__u32	s_reserved[190];	                /* Padding to the end of the block */  
};
```


# 文件存储

在了解了文件系统的底层结构之后，我们再来看看不同类型的文件在文件系统中是如何存储的。

## 普通文件存储

>当我们在 Linux 下的 ext2 建立一个一般文件时， ext2 会分配一个 inode 与相对于该文件大小的block 数量给该文件。例如：假设我的一个 block 为 4 Kbytes ，而我要建立一个 100 KBytes 的文件，那么 linux 将分配一个 inode 与 25 个 block 来储存该文件！ 但同时请注意，由于 inode 仅有 12 个直接指向，因此还要多一个 block 来作为区块号码的记录

在讨论普通文件存储时，我们可以根据普通文件大小分为两种类型：

- 小文件存储：占用 Block 数量小于 `EXT2_N_BLOCKS`
- 大文件存储：占用 Block 数量大于 `EXT2_N_BLOCKS`

对于小文件存储，其基本原理是：根据 inode 的 `i_block[]` 数组中保存的 Block 指针（Block 序号），找到对应所有的 Block 即可，如下所示。

![](/assets/images/Linux%20磁盘与文件系统管理-小文件占用block.png)

对于大文件存储，由于一个 inode 可引用的 Block 数量的上限是 `EXT2_N_BLOCKS`，因此可以使用 Data Block 存储间接的 inode，从而扩大最终可引用的 Block 数量，如下所示。

![](/assets/images/Linux%20磁盘与文件系统管理-大文件占用block.png)

## 目录文件存储

>当我们在 Linux 下的文件系统建立一个目录时，文件系统会分配一个 inode 与至少一块 block 给该目录。其中，inode 记录该目录的相关权限与属性，并可记录分配到的那块 block 号码； 而 block 则是记录在这个目录下的文件名与该文件名占用的 inode 号码数据。

也就是说目录所占用的 block 内容在记录如下的信息

![](/assets/images/Linux%20磁盘与文件系统管理-目录内存分布.png)


目录文件的 **内容数据** 是由一系列 **目录项** 组成。Ext2 文件系统中目录项的数据结构定义如下所示：

```c
// linux/include/linux/ext2_fs.h  
#define EXT2_NAME_LEN 255  
  
// linux/fs/ext2/ext2.h  
struct ext2_dir_entry_2 {  
	__le32	inode;			/* Inode number */  
	__le16	rec_len;		/* Directory entry length */  
	__u8	name_len;		/* Name length */  
	__u8	file_type;  
	char	name[];			/* File name, up to EXT2_NAME_LEN */  
};
```


每一个目录项定义了一个文件所对应的 inode 序号、目录项长度、文件名长度、文件类型等。关于文件类型，ext2 定义了以下这些文件类型。

|编码|文件类型|
|---|---|
|0|Unknown|
|1|Regular File|
|2|Director|
|3|Character Device|
|4|Block Device|
|5|Named Pipe|
|6|Socket|
|7|Symbolic Link|

以一个 `test` 目录文件为例，其包含以下这些文件。

|   |   |
|---|---|
|1  <br>2  <br>3  <br>4  <br>5  <br>6  <br>7  <br>8|$ ls -la test/  <br>total 20  <br>drwxr-xr-x  3 baochuquan staff       4096 Apr 24 12:12 .  <br>drwxrwxrwt 13 baochuquan staff       8192 Apr 24 12:12 ..  <br>brw-r--r--  1 baochuquan staff     3,   0 Apr 24 12:12 harddisk  <br>lrwxrwxrwx  1 baochuquan staff         14 Apr 24 12:12 linux -> /usr/src/linux  <br>-rw-r--r--  1 baochuquan staff         13 Apr 24 12:12 sample  <br>drwxr-xr-x  2 baochuquan staff       4096 Apr 24 12:12 sources|

`test` 目录文件在文件系统中的 **内容数据** 的存储如下所示。

![](/assets/images/Linux%20磁盘与文件系统管理-目录内存示意图如.png)

这里需要重点注意是 `rec_len`，`rec_len` 表示 **从当前目录项的 `rec_len` 末尾开始，到下一个目录项的 `rec_len` 末尾结束的偏移量字节数**。当文件系统从目录文件中删除某一个子目录时，比如 `deldir` 目录，这时候并不会删除对应的目录项，仅仅是修改删除项之前目录项的 `rec_len` 值，从而使得文件系统在扫描目录内容时，跳过 `deldir` 目录项。这也是为什么图中 `deldir` 之前的目录项的 `rec_len` 为 32。

## 软链接存储(符号链接Symbolic link)

软链接，即符号链接，类似于 Windows 操作系统中的快捷方式，它的作用是指向原文件或目录。

软链接一般情况下不占用 Data Block，仅仅通过它对应的 inode 完成信息记录，只有当目标路径占用的字符数超过 60 字节时，文件系统才会分配一个 Data Block 来存储目标路径。

注意，软链接的 Data Block 存储的是 **目标文件名**，比如：`nox -> /Users/baochuquan/Develop/nox/nox.sh` 中 `/Users/baochuquan/Develop/nox/nox.sh` 即目标路径, 当来源档被删除之后，symbolic link 的文件会开不了

举例来说，我们先建立一个符号链接文件链接到 /etc/crontab
```shell
[root@study ~]# ln -s /etc/crontab crontab2
[root@study ~]# ll -i /etc/crontab /root/crontab2
34474855 -rw-r--r--. 2 root root 451 Jun 10 2014 /etc/crontab
53745909 lrwxrwxrwx. 1 root root 12 Jun 23 22:31 /root/crontab2 -> /etc/crontab
```
由上表的结果我们可以知道两个文件指向不同的 inode 号码，当然就是两个独立的文件存在！ 而且  
连结档的重要内容就是他会写上目标文件的『文件名』，你可以发现为什么上表中连结档的大小为 12  
bytes 呢？ 因为箭头(-->)右边的档名『/etc/crontab』总共有 12 个英文，每个英文占用 1 个 bytes ，  
所以文件大小就是 12bytes 了！

![|800](/assets/images/Linux%20磁盘与文件系统管理-符号链接文件读取示意图.png)

由 1 号 inode 读取到连结档的内容仅有档名，根据档名链接到正确的目录去取得目标文件的 inode ，  
最终就能够读取到正确的数据了。你可以发现的是，如果目标文件(/etc/crontab)被删除了，那么整个  
环节就会无法继续进行下去， 所以就会发生无法透过连结档读取的问题了！

Symbolic Link 与 Windows 的快捷方式可以给他划上等号，由 Symbolic  link 所建立的文件为一个独立的新的文件，所以会占用掉 inode 与 block

## 硬链接存储

文件名只与目录有关，文件内容则与 inode 有关。
- 每个文件都会占用一个 inode ，文件内容由 inode 的记录来指向；  
- 文件名以及文件inode的映射关系表在所属目录中保存
- 想要读取该文件，必须要经过目录记录的文件名来指向到正确的 inode 号码才能读取。

通过上文，我们知道目录项存储了 inode 序号、文件名等信息。假如，有两个目录项存储了不同的文件名，但它们的 inode 序号却相同，这会是一种什么样的情况呢？事实上，这就是硬链接，即 inode 相同的文件。

简单的说：hard link 只是在某个目录下新增一笔文件名链接到某 inode 号码的关连记录而已。

例如：假设我系统有个 /root/crontab 他是 /etc/crontab 的实体链接，也就是说这两个档名连  
结到同一个 inode ， 自然这两个文件名的所有相关信息都会一模一样(除了文件名之外)。实际的情  
况可以如下所示：
![|800](/assets/images/Linux%20磁盘与文件系统管理-hardlink举例.png)

透过 1 或 2 的目录之 inode 指定的 block 找到两个不同的档名，而不管使用哪个档名均可以指到 real 那个 inode 去读取到最终数据，如果你将任何一个『档名』删除，其实 inode 与 block 都还是存在的，只不过链接数减一，直至链接数减到0才删除，使用 hard link 设定链接文件时，磁盘的空间与 inode 的数目都不会改变，图中可以知道， hard link 只是在某个目录下的 block 多写入一个关连数据而已，既不会增加 inode 也不会耗用 block 数量

![|800](/assets/images/Linux%20磁盘与文件系统管理-hardlink读取示意图.png)


![](/assets/images/Linux%20磁盘与文件系统管理-硬链接.png)

与编程语言中的引用计数类似，inode 也是用一个字段 `i_links_count` 来记录其被引用的数量。

- 当创建一个文件的硬链接时，对应的 inode 的链接数会加 1；
- 当删除一个文件时，如果对应的 inode 的链接数大于 1 时，则仅仅对链接数进行减 1 操作；如果对应的 inode 的链接数等于 1 时，则会删除 inode 中的 Block 指针。

### 目录的硬链接数量

在创建目录的同时，文件系统会为它创建两个目录：`.` 和 `..`，分别对应当前目录的硬链接、上级目录的硬链接。因此，每一个目录都会包含这两个硬链接，它包含了两个信息：

- 一个不包含子目录的目录文件，其硬链接数量为 2。其一是目录本身，即目录 Data Block 中的 `.`；其二是父级目录 Data Block 中该目录的目录项。
- 一个包含子目录的目录文件，其硬链接数量为 2 + 子目录数。因为每一个子目录都关联一个父级目录的硬链接 `..`。

文件系统会自动为目录创建硬链接，该权限未对用户开放，用户无法对目录创建硬链接。因此，硬链接只能对文件创建，不能跨 Filesystem；

# 文件操作

## 文件读取

关于文件读取，可以分为两个部分：首先，找到父级目录中关于目标文件的元信息；然后，根据目标文件的元信息找到目标文件的内容数据。整体可以分为如下几个步骤：

目录树是由根目录开始读起，因此系统透过挂载的信息可以找到挂载点的 inode 号码，此时就  
能够得到根目录的 inode 内容，并依据该 inode 读取根目录的 block 内的文件名数据，再一层一层  
的往下读到正确的档名。

- step 1：根据 Super Block 和 GDT 找到目标文件的父级目录的区块组
- step 2：根据区块组描述符找到区块组中的 Inode Table
- step 3：根据 Inode 序号，从 Inode Table 中找到父级目录的 Inode
- step 4：根据 Inode 找到父级目录 Data Block
- step 5：遍历父级目录的 Data Block 中的目录项，找到与目标文件名匹配的目录项
- step 6：根据目录项中的 Inode 序号，找到目标文件的 Data Block

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/filesystem-arch-09.png?x-oss-process=image/resize,w_800)

下面，我们以 `cat /var/log/message` 命令为例，来介绍一下其具体过程。

文件系统在查找 `/var/log/message` 时，会将它转换成 4 个类似的步骤，逐步完成。这 4 个阶段分别是：

- 查找根目录 `/`
- 查找 `/` 目录下的 `var` 子目录
- 查找 `/var` 目录下的 `log` 子目录
- 查找 `/var/log` 目录下的 `message` 文件

在详细介绍这 4 个阶段之前，我们需要知道一个前提：在操作系统启动后， 操作系统会挂载根文件系统，此时 Super Block 和 GDT 会被加载至内存之中。

### 查找根目录

上文，我们提到文件系统预留了一些 inode 序号，其中根目录 `/` 的 inode 序号为 128。因此，可以根据 Super Block 的参数定位到 inode 所在的区块组，结合 GDT 获取到区块组的元信息，即区块描述符。

根据区块描述符，找到对应的 Inode Table，从而定位到具体的 inode，并根据 `i_blocks[]` 数组，找到对应的 Data Block。

此时，我们获取到了根目录 `/` 的所有信息。

### 查找 `var` 目录

获取到了根目录 `/` 的 Data Block 之后，我们可以遍历其中的目录项 `dir entry`，找到文件名与 `var` 匹配的目录项。根据目录项中的 inode 序号，结合 Super Block 和 GDT，依次定位到区块组、Inode Table、Inode、Data Block。

此时，我们获取到了 `/var` 目录的所有信息。

### 查找 `log` 目录

获取到了 `/var` 目录的 Data Block 之后，我们可以遍历其中的目录项，找到文件名与 `log` 匹配的目录项。根据目录项中的 inode 序号，结合 Super Block 和 GDT，与查找 `var` 目录一样，也能够定位到区块组、Inode Table、Inode、Data Block。

此时，我们获取到了 `/var/log` 目录的所有信息。

### 查找 `message` 文件

获取到了 `/var/log` 目录的 Data Block 之后，我们可以遍历其中的目录项，找到文件名与 `message` 匹配的目录项。根据目录项中的 inode 序号，结合 Super Block 和 GDT，我们最终就能找到文件内存数据所存放的一组 Data Block 中。

## 文件删除

关于文件的删除，我们分别介绍一下 **普通文件** 和 **目录文件** 的删除操作。

### 普通文件删除

对于普通文件删除，其大致可分为以下几个步骤：

- step 1：找到目标文件 Inode 和 Data Block
- step 2：将 Inode Table 中对应 Inode 中的 Data Block 指针删除（位于 `i_blocks[]` 中）
- step 3：在 Inode Bitmap 中，将对应 Inode 标记为未使用
- step 4：找到目标文件的父级目录的 Data Block，将与目标文件匹配的目录项删除。具体做法是：
    - 修改对应目录项的 inode 序号设置为 0
    - 修改前一个目录项的 `rec_len`，使文件系统在扫描时能够跳过被删除的目录项
- step 5：在 Block Bitmap 中，将对应的 Block 标记为未使用

### 目录文件删除

对于目录文件删除，其大致可分为以下几个步骤：

- step 1：找到目录及其目录下的所有文件、子目录、子文件的 Inode 和 Data Block
- step 2：在 Inode Bitmap 中，将所有对应的 Inode 标记为未使用
- step 3：在 Block Bitmap 中，将所有对应的 Block 标记为未使用
- step 4：找到目标目录的父级目录的 Data Block，将与目标目录匹配的目录项删除。

相比而言，目录文件删除时，需要将子目录和子文件全部删除。

## 文件重命名

关于文件的重命名，我们分别介绍一下 **同目录内** 和 **非同目录内** 的重命名操作。

### 同目录内重命名

同目录内重命名，其仅仅是找到目录的 Data Block 中对应的目录项，并将原始文件名修改为目标文件名。

### 非同目录内重命名

非同目录内重命名，本质上就是文件移动操作。具体细节，见下一节。

## 文件移动

文件移动，可分两种情况讨论，分别是 **目标路径下有同名文件** 和 **目标路径下无同名文件**。

假设，我们要将执行 `mv /origin/file /target/file` 操作。

如果目标路径下有同名文件，文件移动操作可以分为两部分：

- 找到 `/origin` 目录的 Data Block，将 `file` 文件的目录项删除。
- 找到 `/target` 目录的 Data Block，将同名文件 `file` 的目录项的 inode 序号修改为新的 inode 序号。

如果目标路径下无同名文件，文件移动操作也可以分为两部分：

- 找到 `/origin` 目录的 Data Block，将 `file` 文件的目录项删除。
- 找到 `/target` 目录的 Data Block，新增一个 `file` 文件的目录项。

文件移动本质上就是修改了文件的目录项中 Inode 的指针或新增目录项，因此速度非常快。

# 多文件系统

上文所有的内容的前提都是在一个文件系统内完成的，下面，我们在来讨论一下多文件系统的相关内容。

## 挂载点的意义 (mount point)

每个 filesystem 都有独立的 inode / block / superblock 等信息，这个文件系统要能够链接到目录树才能被我们使用。 将文件系统与目录树结合的动作我们称为『挂载』。**挂载点一定是目录**，该目录为进入该文件系统的**入口**。 因此并不是你有任何文件系统都能使用，必须要『挂载』到目录树的某个目录后，才能够使用该文件系统的。

举例来说，如果你是依据鸟哥的方法安装你的 CentOS 7.x 的话， 那么应该会有三个挂载点才是，分  
别是 /, /boot, /home 三个 (鸟哥的系统上对应的装置文件名为 LVM, LVM, /dev/vda2)。 那如果观察  
这三个目录的 inode 号码时，我们可以发现如下的情况：
```shell
[root@study ~]# ls -lid / /boot /home
128 dr-xr-xr-x. 17 root root 4096 May 4 17:56 /
128 dr-xr-xr-x. 4 root root 4096 May 4 17:59 /boot
128 drwxr-xr-x. 5 root root 41 Jun 17 00:20 /home
```

由于 XFS filesystem 最顶层的目录之 inode 一般为 128 号，因此可以发现 /, /boot, /home为三个不同的 filesystem，根目录下的 . 与 .. 是相同的东西， 因为权限是一模一样
```shell
[root@study ~]# ls -ild / /. /..
128 dr-xr-xr-x. 17 root root 4096 May 4 17:56 /
128 dr-xr-xr-x. 17 root root 4096 May 4 17:56 /.
128 dr-xr-xr-x. 17 root root 4096 May
```

## 根文件系统

任何一个文件系统要在 Linux 中正常使用，必须挂载到一个以挂载的文件系统的某个目录下。

类似于一棵多叉树，操作系统也会有一个根文件系统。根文件系统下某个目录如果挂载了某个文件系统，该目录节点被称为 **一级挂载点**；如果这个挂载的文件系统下的某个目录又挂载了某个文件系统，该目录节点被称为 **二级挂载点**。以此类推。

举个例子，如果 `/dev/sdb1` 挂载至根文件系统的 `/mydata` 目录下，那么 `/mydata` 就是 **一级挂载点**；如果 `/dev/cdrom` 又挂载至 `/dev/sdb1` 文件系统的 `/mydata/cdrom` 目录下，那么 `/mydata/cdrom` 就是 **二级挂载点**。

## 文件系统挂载

关于文件系统挂载，我们以 `mount /dev/cdrom /mnt` 为例，进行介绍。

在文件系统 `/dev/cdrom` 挂载至挂载点 `/mnt` 之前，`/mnt` 是根文件系统的一个目录，其父级目录 `/` 的 Data Block 中存储了 `/mnt` 文件对应的目录项，其中包含了文件元信息，如：Inode 序号、文件名等。

当文件系统 `/dev/cdrom` 挂载至挂载点 `/mnt` 之后，`/mnt` 变成了另一个文件系统的入口。对于挂载，操作系统具体做了以下这些内容。

- 在根文件系统的 Inode Table 中，新增一个 Inode 指向文件系统 `/dev/cdrom` 中的 Data Block。
- 找到根文件系统的 `/` 目录的 Data Block，将 `/mnt` 对应的目录项的 Inode 序号修改为新增的 Inode 序号。
- 在根文件系统的 Inode Table 中，将原始的 `/mnt` 的 Inode 标记为暂不可用。

如下所示，为文件系统挂载操作的示意图。**文件系统挂载完成后，挂载点的元数据和内容数据分别存储在不同的文件系统中**。

![](https://chuquan-public-r-001.oss-cn-shanghai.aliyuncs.com/sketch-images/filesystem-arch-10.png?x-oss-process=image/resize,w_800)

## 文件系统卸载

关于文件系统卸载，其本质就是挂载的还原操作，它会移除新增的 Inode，并将指针指向原来的 Data Block。同时挂载点所对应的目录项的 Inode 指针也会恢复原来的设置。


## Linux VFS (Virtual Filesystem Switch)

整个 Linux 的系统都是透过一个名为 Virtual Filesystem Switch 的核心功能去读取 filesystem 的。 也就是说，整个 Linux 认识的 filesystem 其实都是 VFS 在进行管理.

![|500](/assets/images/Linux%20磁盘与文件系统管理-VFS中间层.png)

Linux常见的支持文件系统有：
- 传统档案系统：ext2 / minix / MS-DOS / FAT (用vfat 模组) / iso9660 (光碟)等等；
- 日志式档案系统： ext3 /ext4 / ReiserFS / Windows' NTFS / IBM's JFS / SGI's XFS / ZFS
- 网路档案系统： NFS / SMBFS

想要知道你的 Linux 支持的文件系统有哪些，可以察看底下这个目录：
`[root@study ~]# ls -l /lib/modules/$(uname -r)/kernel/fs`

系统目前已加载到内存中支持的文件系统则有：
`[root@study ~]# cat /proc/filesystems`



# XFS文件系统简介

### XFS 文件系统的配置

xfs 文件系统在资料的分布上，主要规划为三个部份，一个<font color="#c00000">资料区 (data section)</font>、一个文件系统<font color="#c00000">活动  </font>
<font color="#c00000">登录区 (log section)</font>以及一个<font color="#c00000">实时运作区 (realtime section)</font>。 这三个区域的数据内容如下：

#### 资料区 (data section)

数据区就跟我们之前谈到的 ext 家族一样，包括 inode/data block/superblock 等数据，都放置在这个区块。 这个数据区与 ext 家族的 block group 类似，也是分为多个储存区群组(**allocation groups**) 来分别放置文件系统所需要的数据。 每个储存区群组都包含了 (1)整个文件系统的 superblock、 (2)剩余空间的管理机制、 (3)inode 的分配与追踪。此外，**inode 与 block 都是系统用到时才动态配置产生，所以格式化动作超级快**

与 **ext 家族不同**的是， xfs 的 block 与 inode 有多种不同的容量可供设定，**block 容量可由 512bytes ~ 64K 调配**，不过，Linux 的环境下， 由于内存控制的关系 (页面文件 pagesize 的容量之故)，因此**最高可以使用的 block 大小为 4K** , 高于4K后系统无法挂载。 至于 **inode 容量**可由 256bytes 到 2M 这么大！不过，大概还是**保留 256bytes** 的默认值就很够用了

总之， xfs 的这个数据区的储存区群组 (allocation groups, AG)，你就将它想成是 ext家族的 block 群组 (block groups) ，只是 inode 与 block 是动态产生，并非一开始于格式化就完成配置的。

#### 文件系统活动登录区 (log section)

用来记录文件系统的变化（日志区），文件的变化会在这里记录，直到该变化完整的写入到数据区后， 该笔记录才会被终结。如果文件系统因为某些缘故 (例如最常见的停电) 而损毁时，系统会拿这个登录区块来进行检验，看看系统挂掉之前， 文件系统正在运作些啥动作，以快速的修复文件系统。


#### 实时运作区 (realtime section)  

当有文件要被建立时，xfs 会在这个区段里面找一个到数个的 extent 区块，将文件放置在这个区块内，等到分配完毕后，再写入到 data section 的 inode 与 block 去！ 这个 extent 区块的大小得要在格式化的时候就先指定，最小值是 4K 最大可到 1G。一般非磁盘阵列的磁盘默认为 64K容量，而具有类似磁盘阵列的 stripe 情况下，则建议 extent 设定为与 stripe 一样大较佳。这个extent 最好不要乱动，因为可能会影响到实体磁盘的效能。


### XFS 文件系统的xfs_info命令

```shell
[root@study ~]# xfs_info 挂载点|分区装置文件名
范例一：找出系统 / 这个挂载点底下的文件系统的 superblock 纪录

[root@study ~]# df -Th /
文件系统                类型    容量  已用  可用  已用% 挂载点
/dev/mapper/centos-root xfs    10G  5.2G  4.9G   52%  /

# 没错！可以看得出来是 xfs 文件系统的！来观察一下内容吧！
[root@study ~]# xfs_info /dev/mapper/centos-root
meta-data=/dev/mapper/centos-root isize=256    agcount=4, agsize=655360 blks
         =                       sectsz=512   attr=2, projid32bit=1
         =                       crc=0        finobt=0
data     =                       bsize=4096   blocks=2621440, imaxpct=25
         =                       sunit=0      swidth=0 blks
naming   =version 2              bsize=4096   ascii-ci=0 ftype=0
log      =internal               bsize=4096   blocks=2560, version=2
         =                       sectsz=512   sunit=0 blks, lazy-count=1
realtime =none                   extsz=4096   blocks=0, rtextents=0
```

上面的输出讯息可以这样解释：

- 第1 行里面的isize 指的是inode 的容量，每个有256bytes 这么大。至于agcount 则是前面谈到的储存区群组(allocation group) 的个数，共有4 个， agsize 则是指每个储存区群组具有655360 个block 。配合第4 行的block 设定为4K，因此整个档案系统的容量应该就是4\*655360\*4K 这么大！
- 第2 行里面sectsz 指的是逻辑扇区(sector) 的容量设定为512bytes 这么大的意思。
- 第4 行里面的bsize 指的是block 的容量，每个block 为4K 的意思，共有2621440=655360\*4 个block 在这个档案系统内。
- 第5 行里面的sunit 与swidth 与磁碟阵列的stripe 相关性较高。这部份我们底下格式化的时候会举一个例子来说明。
- 第7 行里面的internal 指的是这个登录区的位置在档案系统内，而不是外部设备的意思。且占用了4K * 2560 个block，总共约10M 的容量。
- 第9 行里面的realtime 区域，里面的extent 容量为4K。不过目前没有使用。


# 文件系统的简单操作

## dumpe2fs： 查询Ext 家族superblock 信息的指令

![|1050](/assets/images/Linux%20磁盘与文件系统管理-dumpe2fs.png)

```shell
[root@study ~]# dumpe2fs [-bh] 装置档名
选项与参数：
-b ：列出保留为坏轨的部分(一般用不到吧！？)
-h ：仅列出superblock 的资料，不会列出其他的区段内容！
范例：鸟哥的一块1GB ext4 档案系统内容
[root@study ~]# blkid    <==这个指令可以叫出目前系统有被格式化的装置
/dev/vda1: LABEL="myboot" UUID="ce4dbf1b-2b3d-4973-8234-73768e8fd659" TYPE="xfs"
/dev/vda2: LABEL="myroot" UUID="21ad8b9a-aaad-443c-b732-4e2522e95e23" TYPE="xfs"
/dev/vda3: UUID="12y99K-bv2A-y7RY-jhEW-rIWf-PcH5-SaiApN" TYPE="LVM2_member"
/dev/vda5: UUID="e20d65d9-20d4-472f-9f91-cdcfb30219d6" TYPE="ext4"   <==看到ext4 了！
[root@study ~]# dumpe2fs /dev/vda5
dumpe2fs 1.42.9 (28-Dec-2013)
Filesystem volume name: <none>            # 档案系统的名称(不一定会有) 
Last mounted on: <not available>   # 上一次挂载的目录位置
Filesystem UUID: e20d65d9-20d4-472f-9f91-cdcfb30219d6 
Filesystem magic number: 0xEF53            # 上方的UUID 为Linux 对装置的定义码
Filesystem revision #: 1 (dynamic)       # 下方的features 为档案系统的特征资料
Filesystem features: has_journal ext_attr resize_inode dir_index filetype extent 64bit
 flex_bg sparse_super large_file huge_file uninit_bg dir_nlink extra_isize
Filesystem flags: signed_directory_hash
Default mount options: user_xattr acl    # 预设在挂载时会主动加上的挂载参数
Filesystem state: clean             # 这块档案系统的状态为何，clean 是没问题
Errors behavior: Continue
Filesystem OS type: Linux
Inode count: 65536             # inode 的总数
Block count: 262144            # block 的总数
Reserved block count: 13107             # 保留的block 总数
Free blocks: 249189            # 还有多少的block 可用数量
Free inodes: 65525             # 还有多少的inode 可用数量
First block: 0
Block size: 4096              # 单个block 的容量大小
Fragment size: 4096
Group descriptor size: 64
....(中间省略).... 
Inode size: 256               # inode 的容量大小！已经是256 了喔！
....(中间省略)....
Journal inode: 8
Default directory hash: half_md4
Directory Hash Seed: 3c2568b4-1a7e-44cf-95a2-c8867fb19fbc
Journal backup: inode blocks
Journal features: (none)
Journal size: 32M               # Journal 日志式资料的可供纪录总容量
Journal length: 8192
Journal sequence: 0x00000001
Journal start: 0
Group 0: (Blocks 0-32767)                   # 第一块block group 位置
  Checksum 0x13be, unused inodes 8181
  Primary superblock at 0, Group descriptors at 1-1    # 主要superblock 的所在喔！
  Reserved GDT blocks at 2-128
  Block bitmap at 129 (+129), Inode bitmap at 145 (+145)
  Inode table at 161-672 (+161)                        # inode table 的所在喔！
  28521 free blocks, 8181 free inodes, 2 directories, 8181 unused inodes
  Free blocks: 142-144, 153-160, 4258-32767            # 底下两行说明剩余的容量有多少
  Free inodes: 12-8192
Group 1: (Blocks 32768-65535) [INODE_UNINIT]           # 后续为更多其他的block group 喔！
....(底下省略)....
 # 由于资料量非常的庞大，因此鸟哥将一些资讯省略输出了！上表与你的萤幕会有点差异。
# 前半部在秀出supberblock 的内容，包括标头名称(Label)以及inode/block的相关资讯
# 后面则是每个block group 的个别资讯了！您可以看到各区段资料所在的号码！
# 也就是说，基本上所有的资料还是与block 的号码有关很重要！
```

内容主要可以区分为上半部是superblock 内容， 下半部则是每个block group 的信息，这个 /dev/vda5 规划的 block 为 4K， 第一个 block 号码为 0 号，且 block group 内的所有信息都以block 的号码来表示的。然后在 superblock 中还有谈到目前这个文件系统的可用 block 与 inode 数量. 

至于block group 的内容我们单纯看 Group0
- Group0 所占用的block 号码由0 到32767 号，superblock 则在第0 号的block 区块内！
- 文件系统描述说明在第1 号block 中；
- block bitmap 与inode bitmap 则在129 及145 的block 号码上。
- 至于inode table 分布于161-672 的block 号码中！
- 由于(1)一个inode 占用256 bytes ，(2)总共有672 - 161 + 1(161本身) = 512 个block 花在inode table 上， (3)每个block 的大小为4096 bytes(4K)。由这些数据可以算出inode 的数量共有512 * 4096 / 256 = 8192 个inode 啦！
- 这个Group0 目前可用的block 有28521 个，可用的inode 有8181 个；
- 剩余的inode 号码为12 号到8192 号。



##  磁盘与目录的容量

[df：列出文件系统的整体磁盘使用量](#df列出系统各个分区的容量)
[du：评估文件系统的磁盘使用量,常用在推估目录所占容量](#du磁盘容量)

### df列出系统各个分区的容量

列出系统各个分区的容量
```shell
[root@study ~]# df [-ahikHTm] [目录或文件名]
选项与参数：
-a ：列出所有的文件系统，包括系统特有的 /proc 等文件系统；
-k ：以 KBytes 的容量显示各文件系统；
-m ：以 MBytes 的容量显示各文件系统；
-h ：以人们较易阅读的 GBytes, MBytes, KBytes 等格式自行显示；
-H ：以 M=1000K 取代 M=1024K 的进位方式；
-T ：连同该 partition 的 filesystem 名称 (例如 xfs) 也列出；
-i ：不用磁盘容量，而以 inode 的数量来显示
```

范例一：将系统内所有的 filesystem 列出来！
```shell
[root@study ~]# df
文件系统                   1K-块    已用    可用 已用% 挂载点
/dev/mapper/centos-root 10475520 5361060 5114460   52% /
devtmpfs                  925324       0  925324    0% /dev
tmpfs                     935256     148  935108    1% /dev/shm
tmpfs                     935256    9136  926120    1% /run
tmpfs                     935256       0  935256    0% /sys/fs/cgroup
/dev/sda2                1038336  133948  904388   13% /boot
/dev/mapper/centos-home  5232640   67976 5164664    2% /home
# 在 Linux 底下如果 df 没有加任何选项，那么默认会将系统内所有的
# (不含特殊内存内的文件系统与 swap) 都以 1 Kbytes 的容量来列出来！
# 至于那个 /dev/shm 是与内存有关的挂载，先不要理他！
```

先来说明一下范例一所输出的结果讯息为：  
- Filesystem：代表该文件系统是在哪个 partition ，所以列出装置名称；  
- 1k-blocks：说明底下的数字单位是 1KB 呦！可利用 -h 或 -m 来改变容量单位；  
- Used：顾名思义，就是使用掉的磁盘空间啦！  
- Available：也就是剩下的磁盘空间大小；  
- Use%：就是磁盘的使用率啦！如果使用率高达 90% 以上时， 最好需要注意一下了，免得容量不足造成系  统问题喔！(例如最容易被灌爆的 /var/spool/mail 这个放置邮件的磁盘)  
- Mounted on：就是磁盘挂载的目录所在啦！(挂载点啦！)

```shell
范例二：将容量结果以易读的容量格式显示出来
[root@study ~]# df -h
文件系统                 容量  已用  可用 已用% 挂载点
/dev/mapper/centos-root   10G  5.2G  4.9G   52% /
devtmpfs                 904M     0  904M    0% /dev
tmpfs                    914M  148K  914M    1% /dev/shm
tmpfs                    914M  9.0M  905M    1% /run
tmpfs                    914M     0  914M    0% /sys/fs/cgroup
/dev/sda2               1014M  131M  884M   13% /boot
/dev/mapper/centos-home  5.0G   67M  5.0G    2% /home
# 不同于范例一，这里会以 G/M 等容量格式显示出来，比较容易看啦！

范例三：将系统内的所有特殊文件格式及名称都列出来
[root@study ~]# df -aT
[root@study ~]# df -aT
文件系统                类型               1K-块    已用    可用 已用% 挂载点
rootfs                  rootfs          10475520 5361104 5114416   52% /
proc                    proc                   0       0       0     - /proc
sysfs                   sysfs                  0       0       0     - /sys
devtmpfs                devtmpfs          925324       0  925324    0% /dev
securityfs              securityfs             0       0       0     - /sys/kernel/security
tmpfs                   tmpfs             935256     148  935108    1% /dev/shm
devpts                  devpts                 0       0       0     - /dev/pts
tmpfs                   tmpfs             935256    9136  926120    1% /run
tmpfs                   tmpfs             935256       0  935256    0% /sys/fs/cgroup
cgroup                  cgroup                 0       0       0     - /sys/fs/cgroup/systemd
pstore                  pstore                 0       0       0     - /sys/fs/pstore
configfs                configfs               0       0       0     - /sys/kernel/config
/dev/mapper/centos-root xfs             10475520 5361104 5114416   52% /
systemd-1               autofs                 0       0       0     - /proc/sys/fs/binfmt_misc
debugfs                 debugfs                0       0       0     - /sys/kernel/debug
mqueue                  mqueue                 0       0       0     - /dev/mqueue
hugetlbfs               hugetlbfs              0       0       0     - /dev/hugepages
/dev/sda2               xfs              1038336  133948  904388   13% /boot
/dev/mapper/centos-home xfs              5232640   67976 5164664    2% /home
gvfsd-fuse              fuse.gvfsd-fuse        0       0       0     - /run/user/1000/gvfs
# 系统里面其实还有很多特殊的文件系统存在的。那些比较特殊的文件系统几乎
# 都是在内存当中，例如 /proc 这个挂载点。因此，这些特殊的文件系统
# 都不会占据磁盘空间！ 

范例四：将 /etc 底下的可用的磁盘容量以易读的容量格式显示
[root@study ~]# df -h /etc
文件系统                 容量  已用  可用 已用% 挂载点
/dev/mapper/centos-root   10G  5.2G  4.9G   52% /
# 这个范例比较有趣一点啦，在 df 后面加上目录或者是文件时， df
# 会自动的分析该目录或文件所在的 partition ，并将该 partition 的容量显示出来，显示的是/的可用容量
# 所以，您就可以知道某个目录底下还有多少容量可以使用了！

范例五：将目前各个 partition 当中可用的 inode 数量列出
[root@study ~]# df -ih
文件系统                Inode 已用(I) 可用(I) 已用(I)% 挂载点
/dev/mapper/centos-root   10M    132K    9.9M       2% /
devtmpfs                 226K     410    226K       1% /dev
tmpfs                    229K       8    229K       1% /dev/shm
tmpfs                    229K     564    228K       1% /run
tmpfs                    229K      13    229K       1% /sys/fs/cgroup
/dev/sda2                1.0M     330    1.0M       1% /boot
/dev/mapper/centos-home  5.0M     258    5.0M       1% /home
# 这个范例则主要列出可用的 inode 剩余量与总容量。分析一下与范例一的关系，
# 你可以清楚的发现到，通常 inode 的数量剩余都比 block 还要多呢
```

>由于 df 主要读取的数据几乎都是针对一整个文件系统，因此读取的范围主要是在 Superblock 内的  信息， 所以这个指令显示结果的速度非常的快速！在显示的结果中你需要特别留意的是那个根目录  的剩余容量！ 因为我们所有的数据都是由根目录衍生出来的，因此当根目录的剩余容量剩下 0 时，  那你的 Linux 可能就问题很大了。

>如果使用 -a 这个参数时，系统会出现 /proc 这个挂载点，但是里面的东西都是0 ，不要紧张！ /proc 的东西都是 Linux 系统所需要加载的系统数据，而且是挂载在『内存当中』的， 所以当然没有占任何的磁盘空间啰！  

>至于那个 /dev/shm/ 目录，其实是利用内存虚拟出来的磁盘空间，通常是总物理内存的一半！ 由于是透过内存仿真出来的磁盘，因此你在这个目录底下建立任何数据文件时，访问速度是非常快速的！(在内存内工作) 不过，也由于他是内存仿真出来的，因此这个文件系统的大小在每部主机上都不一样，而且建立的东西在下次开机时就消失了！ 因为是在内存中


### du磁盘容量

```shell
[root@study ~]# du [-ahskm] 文件或目录名称
选项与参数：
-a ：列出所有的文件与目录容量，因为默认仅统计目录底下的文件量而已。
-h ：以人们较易读的容量格式 (G/M) 显示；
-s ：列出总量而已，而不列出每个各别的目录占用容量；
-S ：不包括子目录下的总计，与 -s 有点差别。
-k ：以 KBytes 列出容量显示；默认
-m ：以 MBytes 列出容量显示；

范例一：列出目前目录下的所有文件容量
[root@study ~]# du
4       ./.cache/dconf  <==每个目录都会列出来
4       ./.cache/abrt   <==包括隐藏文件的目录
8       ./.cache
4       ./.dbus/session-bus
4       ./.dbus
0       ./.config/abrt
0       ./.config
56      .              <==这个目录(.)所占用的总量
# 直接输入 du 没有加任何选项时，则 du 会分析『目前所在目录』
# 的文件与目录所占用的磁盘空间。但是，实际显示时，仅会显示目录容量(不含文件)，
# 因此 . 目录有很多文件没有被列出来，所以全部的目录相加不会等于 . 的容量喔！
# 此外，输出的数值数据为 1K 大小的容量单位。


[root@study testdu]# ls -l
总用量 12
-rw-r--r-- 1 root root 59 1月  27 18:35 ttttdu
-rw-r--r-- 1 root root 59 1月  27 18:47 ttttdu2
-rw-r--r-- 1 root root 59 1月  27 18:47 ttttdu3
[root@study testdu]# du -h
12K     .
# 由于block的大小为4k, 一个文件最低占用一个block, 也就是4k
# 所以查看当前目录下占用时，示例有三个文件, 虽然都为59byte,
# 但占用位置大小为4k*3=12k

范例二: 将文件的容量也列出来
[root@study testdu]# du -a
4       ./ttttdu
4       ./ttttdu2
4       ./ttttdu3
12      .

范例三：检查根目录底下每个目录所占用的容量
[root@study testdu]# du -sm /*
0       /bin
99      /boot
1       /dev
28      /etc
35      /home
....(中间省略)....
du: 无法访问"/proc/6333/fd/4": 没有那个文件或目录
du: 无法访问"/proc/6333/fdinfo/4": 没有那个文件或目录
0       /proc  <==不会占用硬盘空间！
1       /root
du: 无法访问"/run/user/1000/gvfs": 权限不够
7241    /run
....(中间省略)....
3395    /usr <==系统初期最大就是他了啦！
1745    /var

# 这是个很常被使用的功能～利用通配符 * 来代表每个目录，如果想要检查某个目录下，
# 哪个次目录占用最大的容量，可以用这个方法找出来。值得注意的是，如果刚刚安装好 Linux 时，
# 那么整个系统容量最大的应该是 /usr 。而 /proc 虽然有列出容量，但是那个容量是在内存中，
# 不占磁盘空间。至于 /proc 里头会列出一堆『No such file or directory』 的错误，
# 别担心！因为是内存内的程序，程序执行结束就会消失，因此会有些目录找不到，是正确的！
```

与 df 不一样的是，du 直接到文件系统内去搜寻所有的文件数据，会比df耗时！在默认的情况下，容量的输出单位为 KB，可以使用 -m 这个输出MB！使用 -s 只列出目录占用容量！

至于 -S 这个选项部分，由于 du 默认会将所有文件的大小均列出，因此假设你在 /etc 底下使用 du时， 所有的文件大小，包括 /etc 底下的次目录容量也会被计算一次。然后最终的容量 (/etc) 也会加总一次， 因此很多朋友都会误会 du 分析的结果不太对劲。所以如果想要列出某目录下的全部数据， 可以加上 -S 的选项，减少次目录的加总

```shell
[root@study testdu]# ll
总用量 12
drwxr-xr-x 2 root root 19 1月  27 19:13 soon
-rw-r--r-- 1 root root 59 1月  27 18:35 ttttdu
-rw-r--r-- 1 root root 59 1月  27 18:47 ttttdu2
-rw-r--r-- 1 root root 59 1月  27 18:47 ttttdu3
[root@study testdu]# du
4       ./soon
16      .
[root@study testdu]# du -S
4       ./soon
12      .
```

## 软连接硬链接ln

```shell
[root@study ~]# ln [-sf] 来源文件 目标文件
选项与参数：
-s ：如果不加任何参数就进行连结，那就是 hard link，至于 -s 就是 symbolic link
-f ：如果 目标文件 存在时，就主动的将目标文件直接移除后再建立！

范例一：将 /etc/passwd 复制到 /tmp 底下，并且观察 inode 与 block
[root@study ~]# cd /tmp
[root@study tmp]# cp -a /etc/passwd .
[root@study tmp]# du -sb ; df -i .
6602 . <==先注意一下这里的容量是多少！
Filesystem Inodes IUsed IFree IUse% Mounted on
/dev/mapper/centos-root 10485760 109748 10376012 2% /
# 利用 du 与 df 来检查一下目前的参数～那个 du -sb 是计算整个 /tmp 底下有多少 bytes 的容量啦！

范例二：将 /tmp/passwd 制作 hard link 成为 passwd-hd 文件，并观察文件与容量
[root@study tmp]# ln passwd passwd-hd
[root@study tmp]# du -sb ; df -i .
6602 .
Filesystem Inodes IUsed IFree IUse% Mounted on
/dev/mapper/centos-root 10485760 109748 10376012 2% /
# 仔细看，即使多了一个文件在 /tmp 底下，整个 inode 与 block 的容量并没有改变！
[root@study tmp]# ls -il passwd*
2668897 -rw-r--r--. 2 root root 2092 Jun 17 00:20 passwd
2668897 -rw-r--r--. 2 root root 2092 Jun 17 00:20 passwd-hd
# 原来是指向同一个 inode 啊！这是个重点啊！另外，那个第二栏的连结数也会增加！

范例三：将 /tmp/passwd 建立一个符号链接
[root@study tmp]# ln -s passwd passwd-so
[root@study tmp]# ls -li passwd*
2668897 -rw-r--r--. 2 root root 2092 Jun 17 00:20 passwd
2668897 -rw-r--r--. 2 root root 2092 Jun 17 00:20 passwd-hd
2668898 lrwxrwxrwx. 1 root root 6 Jun 23 22:40 passwd-so -> passwd
# passwd-so 指向的 inode number 不同了！这是一个新的文件～这个文件的内容是指向
# passwd 的。passwd-so 的大小是 6bytes ，因为 『passwd』 这个单字共有六个字符之故

[root@study tmp]# du -sb ; df -i .
6608 .
Filesystem Inodes IUsed IFree IUse% Mounted on
/dev/mapper/centos-root 10485760 109749 10376011 2% /
# 呼呼！整个容量与 inode 使用数都改变啰～确实如此啊！

范例四：删除源文件 passwd ，其他两个文件是否能够开启？
[root@study tmp]# rm passwd
[root@study tmp]# cat passwd-hd
.....(正常显示完毕！)
[root@study tmp]# cat passwd-so
cat: passwd-so: No such file or directory
[root@study tmp]# ll passwd*
-rw-r--r--. 1 root root 2092 Jun 17 00:20 passwd-hd
lrwxrwxrwx. 1 root root 6 Jun 23 22:40 passwd-so -> passwd
# 怕了吧！符号链接果然无法开启！另外，如果符号链接的目标文件不存在，
# 其实档名的部分就会有特殊的颜色显示喔！
```

## 磁盘的分区、格式化、检验与挂载

想要在系统里面新增一颗磁盘时，应该有哪些动作需要做的呢:
1. 对磁盘进行分区，以建立可用的 partition ；  
2. 对该 partition 进行格式化 (format)，以建立系统可用的 filesystem；  
3. 若想要仔细一点，则可对刚刚建立好的 filesystem 进行检验；  
4. 在 Linux 系统上，需要建立挂载点 (亦即是目录)，并将他挂载上来


### 观察磁盘分区状态-lsblk/blkid/parted

#### lsblk 列出系统上的所有磁盘列表

- list block device

```shell
[root@study ~]# lsblk [-dfimpt] [device]
选项与参数：
-d ：仅列出磁盘本身，并不会列出该磁盘的分区数据
-f ：同时列出该磁盘内的文件系统名称
-i ：使用 ASCII 的线段输出，不要使用复杂的编码 (再某些环境下很有用)
-m ：同时输出该装置在 /dev 底下的权限数据 (rwx 的数据)
-p ：列出该装置的完整文件名！而不是仅列出最后的名字而已。
-t ：列出该磁盘装置的详细数据，包括磁盘队列机制、预读写的数据量大小等
```

**范例一**：列出本系统下的所有磁盘与磁盘内的分区信息
```shell
[root@study tmp]# lsblk
NAME            MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda               8:0    0   40G  0 disk     # 一整颗磁盘
├─sda1            8:1    0    2M  0 part
├─sda2            8:2    0    1G  0 part /boot
└─sda3            8:3    0   30G  0 part
  ├─centos-root 253:0    0   10G  0 lvm  /   # 在 sda3 内的其他文件系统
  ├─centos-swap 253:1    0    1G  0 lvm  [SWAP]
  └─centos-home 253:2    0    5G  0 lvm  /home
sr0              11:0    1  7.1G  0 rom  /run/media/daihongli/CentOS 7 x86_64
```

从上面的输出我们可以很清楚的看到，目前的系统主要有个 sr0 以及一个 sda 的装置，而 sda 的装置底下又有三个分区， 其中 sda3 甚至还有因为 LVM 产生的文件系统

- NAME：就是设备的文件名，会省略 /dev 等前导目录！  
- MAJ:MIN：内核通过这两个代码识别设备，分别是主要：次要设备代码，同种设备MAJ相同，MIN不同
- RM：是否为可卸除装置 (removable device)，如光盘、USB 磁盘等等，1为可卸载
- SIZE：当然就是容量啰！  
- RO：是否为只读设备的意思  
- TYPE：是磁盘 (disk)、分区槽 (partition) 还是只读存储器 (rom) 等输出  
- MOUTPOINT：就是挂载点！

**范例二**：仅列出 /dev/sda 设备内的所有数据的完整文件名
```shell
[daihongli@daihongli-pc ~]$ lsblk -ip /dev/sda
NAME                    MAJ:MIN RM SIZE RO TYPE MOUNTPOINTS
/dev/sda                  8:0    0  40G  0 disk
|-/dev/sda1               8:1    0   2M  0 part
|-/dev/sda2               8:2    0   1G  0 part /boot
|-/dev/sda3               8:3    0  30G  0 part
| |-/dev/mapper/rl-root 253:0    0  10G  0 lvm  /
| |-/dev/mapper/rl-swap 253:1    0   1G  0 lvm  [SWAP]
| `-/dev/mapper/rl-home 253:2    0   5G  0 lvm  /home
`-/dev/sda4               8:4    0   1G  0 part # 完整的文件名，由 / 开始写
```


#### blkid 列出装置的 UUID 等参数

>可以使用lsblk -f 来列出文件系统与装置的 UUID 数据，但不如blkid直接。**UUID** 是全局单一标识符 (universally  unique identifier)，Linux 会将系统内所有的装置都给予一个独一无二的标识符， 这个标识符就可以拿来作为挂载或者是使用这个装置/文件系统之用了

每一行代表一个文件系统，主要列出装置名称、UUID 名称以及文件系统的类型 (TYPE)
```shell
[root@study ~]# blkid
/dev/sr0: UUID="2015-04-01-00-21-36-00" LABEL="CentOS 7 x86_64" TYPE="iso9660" PTTYPE="dos"
/dev/sda2: UUID="d3dd9ff1-827d-4ac1-9fe6-f3ab1e7b0f5e" TYPE="xfs" PARTUUID="a335616e-8575-4b3a-8cb0-80b0478b3c45"
/dev/sda3: UUID="Kl0wqu-160U-6TsW-gegq-6Q6h-2qaa-D2IAky" TYPE="LVM2_member" PARTUUID="fb4a1bc8-d69e-47df-ab48-0a5f173a040d"
/dev/mapper/centos-root: UUID="651095ce-e0d7-4cd9-a92b-0f22cf4cda3b" TYPE="xfs"
/dev/mapper/centos-swap: UUID="706e61e3-bf3e-4527-8c75-38a1d71b6cab" TYPE="swap"
/dev/mapper/centos-home: UUID="3a20c2fb-2603-40da-a193-a740ea225e42" TYPE="xfs"
```


#### parted 列出磁盘的分区表类型与分区信息

>虽然我们已经知道了系统上面的所有装置，并且透过 blkid 也知道了所有的文件系统！不过，还是不  清楚磁盘的分区类型。 这时我们可以透过简单的 parted 来输出

```shell
[root@study ~]# parted device_name print

范例一：列出 /dev/vda 磁盘的相关数据
[root@study ~]# parted /dev/sda print
Model: VMware, VMware Virtual S (scsi) # 磁盘的模块名称(厂商)
Disk /dev/sda: 42.9GB  # 磁盘的总容量
Sector size (logical/physical): 512B/512B # 磁盘的每个逻辑/物理扇区容量
Partition Table: gpt  # 分区表的格式 (MBR/GPT)
Disk Flags: pmbr_boot

Number  Start   End     Size    File system  Name  标志 # 底下才是分区数据
 1      1049kB  3146kB  2097kB                     bios_grub
 2      3146kB  1077MB  1074MB  xfs
 3      1077MB  33.3GB  32.2GB                     lvm

[root@study ~]# parted /dev/mapper/centos-root print
Model: Linux device-mapper (linear) (dm)
Disk /dev/mapper/centos-root: 10.7GB
Sector size (logical/physical): 512B/512B
Partition Table: loop
Disk Flags:

Number  Start  End     Size    File system  标志
 1      0.00B  10.7GB  10.7GB  xfs

```


### 磁盘分区-gdisk/fdisk/parted

磁盘分区主要有 MBR 以及 GPT 两种格式，分区工具分别为fdisk / gdisk，**不同分区使用的分区工具不要搞错**，也可使用通用工具parted。

#### gdisk

```shell
[root@study ~]# gdisk 设备名称

范例：由前一小节的 lsblk 输出，我们知道系统有个 /dev/sda，请观察该磁盘的分区与相关数据
[root@study ~]# gdisk /dev/sda  <==仔细看，不要加上数字喔！
GPT fdisk (gdisk) version 0.8.6

Partition table scan:
  MBR: protective
  BSD: not present
  APM: not present
  GPT: present

Found valid GPT with protective MBR; using GPT.  <==找到了 GPT 的分区表！

Command (? for help): ?  <==这里可以让你输入指令动作，可以按问号 (?) 来查看可用指令
b       back up GPT data to a file
c       change a partition's name
d       delete a partition  # 删除一个分区
i       show detailed information on a partition
l       list known partition types
n       add a new partition # 增加一个分区
o       create a new empty GUID partition table (GPT)
p       print the partition table # 印出分区表 (常用)
q       quit without saving changes # 不储存分区就直接离开 gdisk
r       recovery and transformation options (experts only)
s       sort partitions
t       change a partition's type code
v       verify disk
w       write table to disk and exit # 储存分区操作后离开 gdisk
x       extra functionality (experts only)
?       print this menu

Command (? for help): p  #<== 这里可以输出目前磁盘的状态
Disk /dev/sda: 83886080 sectors, 40.0 GiB   # 磁盘文件名/扇区数与总容量
Logical sector size: 512 bytes         # 单一扇区大小为 512 bytes
Disk identifier (GUID): 3FFD7B58-862B-4A61-A42B-2B31DC5B34C3  # 磁盘的 GPT 标识符
Partition table holds up to 128 entries
First usable sector is 34, last usable sector is 83886046
Partitions will be aligned on 2048-sector boundaries
Total free space is 18862013 sectors (9.0 GiB)
# 分区编号 开始扇区号码    结束扇区号码   容量大小
Number  Start (sector)    End (sector)  Size       Code  Name # 底下为完整的分区信息了！
   1            2048            6143   2.0 MiB     EF02       # 第一个分区槽数据
   2            6144         2103295   1024.0 MiB  0700
   3         2103296        65026047   30.0 GiB    8E00
```

使用『 p 』可以列出目前这颗磁盘的分区表信息，

这个信息的上半部在显示整体磁盘的状态。这个磁盘共有 40GB 左右的容量，共有 83886080 个扇区，每个扇区的容量为512bytes。 要注意的是，现在的分区主要是以扇区为最小的单位

下半部的分区表信息主要在列出每个分区槽的个别信息项目。每个项目的意义为：  
- Number：分区槽编号，1 号指的是 /dev/vda1 这样计算。  
- Start (sector)：每一个分区槽的开始扇区号码位置  
- End (sector)：每一个分区的结束扇区号码位置，与 start 之间可以算出分区槽的总容量  
- Size：就是分区槽的容量了  
- Code：在分区槽内的可能的文件系统类型。Linux 为 8300，swap 为 8200。不过这个项目只是一个提示而已，不见得真的代表此分区槽内的文件系统！  
- Name：文件系统的名称等等

从上表我们可以发现几件事情：  
- 整部磁盘还可以进行额外的分区，因为最大扇区为 83886080，但只使用到 65026047 号而已；  
- 分区槽的设计中，新分区通常选用上一个分区的结束扇区号码数加 1 作为起始扇区号码！

>这个 gdisk 只有 root 才能执行，此外，请注意，使用的『装置文件名』请不要加上数字，因为 partition是针对『整个磁盘装置』而不是某个 partition, 所以执行『 gdisk /dev/sda1 』 就会发生错误, 要使用 gdisk /dev/sda 才对！

```shell
[root@study ~]# gdisk /dev/sda
Command (? for help): p
Disk /dev/sda: 83886080 sectors, 40.0 GiB
Logical sector size: 512 bytes
Disk identifier (GUID): 3FFD7B58-862B-4A61-A42B-2B31DC5B34C3
Partition table holds up to 128 entries
First usable sector is 34, last usable sector is 83886046
Partitions will be aligned on 2048-sector boundaries
Total free space is 18862013 sectors (9.0 GiB)

Number  Start (sector)    End (sector)  Size       Code  Name
   1            2048            6143   2.0 MiB     EF02
   2            6144         2103295   1024.0 MiB  0700
   3         2103296        65026047   30.0 GiB    8E00
# 找出最后一个 sector 的号码是很重要的！  65026047

Command (? for help): n  # 开始新增的行为
Partition number (4-128, default 4): 4  # 预设就是 4 号，所以也能 enter 即可！
First sector (34-83886046, default = 65026048) or {+-}size{KMGTP}: 65026048  # 也能直接 enter
Last sector (65026048-83886046, default = 83886046) or {+-}size{KMGTP}: +1G  # 坚决不能能直接 enter会把剩下的全分了
# 这个地方可有趣了！我们不需要自己去计算扇区号码，透过 +容量 的这个方式，
# 就可以让 gdisk 主动去帮你算出最接近你需要的容量的扇区号码喔！
Current type is 'Linux filesystem'
Hex code or GUID (L to show codes, Enter = 8300): # 使用默认值即可～直接 enter 下去！
# 这里在让你选择未来这个分区槽预计使用的文件系统！预设都是 Linux 文件系统的 8300 啰！
Changed type of partition to 'Linux filesystem'

Command (? for help): p
Disk /dev/sda: 83886080 sectors, 40.0 GiB
Logical sector size: 512 bytes
Disk identifier (GUID): 3FFD7B58-862B-4A61-A42B-2B31DC5B34C3
Partition table holds up to 128 entries
First usable sector is 34, last usable sector is 83886046
Partitions will be aligned on 2048-sector boundaries
Total free space is 16764861 sectors (8.0 GiB)

Number  Start (sector)    End (sector)  Size       Code  Name
   1            2048            6143   2.0 MiB     EF02
   2            6144         2103295   1024.0 MiB  0700
   3         2103296        65026047   30.0 GiB    8E00
   4        65026048        67123199   1024.0 MiB  8300  Linux filesystem   # 新创建的分区

```

重点在『 Last sector 』那一行，那行绝对不要使用默认值！因为默认值会将所有的容量用光！因此它默认选择最大的扇区号码！ 因为我们仅要 1GB 而已，所以你得要加上 +1G 这样即可！不需要计算 sector 的数量，gdisk 会根据你填写的数值， 直接计算出最接近该容量的扇区数！每次新增完毕后，请立即『 p 』查看一下结果

请继续处理后续的两个分区槽！ 最终出现的画面会有点像底下这样才对！
```shell
Command (? for help): p
Disk /dev/sda: 83886080 sectors, 40.0 GiB
Logical sector size: 512 bytes
Disk identifier (GUID): 3FFD7B58-862B-4A61-A42B-2B31DC5B34C3
Partition table holds up to 128 entries
First usable sector is 34, last usable sector is 83886046
Partitions will be aligned on 2048-sector boundaries
Total free space is 13643709 sectors (6.5 GiB)

Number  Start (sector)    End (sector)  Size       Code  Name
   1            2048            6143   2.0 MiB     EF02
   2            6144         2103295   1024.0 MiB  0700
   3         2103296        65026047   30.0 GiB    8E00
   4        65026048        67123199   1024.0 MiB  8300  Linux filesystem
   5        67123200        69220351   1024.0 MiB  0700  Microsoft basic data
   6        69220352        70244351   500.0 MiB   8200  Linux swap

Command (? for help): w

Final checks complete. About to write GPT data. THIS WILL OVERWRITE EXISTING
PARTITIONS!!
# gdisk 会先警告你可能的问题，我们确定分区是对的，这时才按下 y ！不过怎么还有警告？
# 这是因为这颗磁盘目前正在使用当中，因此系统无法立即加载新的分区表
Do you want to proceed? (Y/N): y
OK; writing new GUID partition table (GPT) to /dev/sda.
Warning: The kernel is still using the old partition table.
The new table will be used at the next reboot.
The operation has completed successfully.
```

基本上，几乎都用默认值，然后透过 +1G, +500M 来建置所需要的另外两个分区槽！文件系统的 ID， Linux 大概都是 8200/8300/8e00 等三种格式， Windows 几乎都用0700，如果忘记这些数字，可以在 gdisk 内按下：『 L 』来显示，确认无误按w写入。

```shell
[root@study ~]# cat /proc/partitions
major minor  #blocks  name

  11        0    7413760 sr0
   8        0   41943040 sda
   8        1       2048 sda1
   8        2    1048576 sda2
   8        3   31461376 sda3
 253        0   10485760 dm-0
 253        1    1048576 dm-1
 253        2    5242880 dm-2
# 你可以发现，并没有 sda4, sda5, sda6 喔！因为核心还没有更新！
```
因为 Linux 此时还在使用这颗磁盘，为了担心系统出问题，所以分区表并没有被更新！这个时候我们有两个方式可以来处理！ 其中一个是**重新启动**, 另外一个则是通过 `partprobe` 这个指令来处理即可！

##### partprobe 更新 Linux 核心的分区表信息

```shell
[root@study ~]# partprobe [-s] # 你可以不要加 -s ！那么屏幕不会出现讯息！


[root@study ~]# partprobe -s  # 不过还是建议加上 -s 比较清晰！
/dev/sda: gpt partitions 1 2 3 4 5 6
[root@study ~]# lsblk /dev/sda  # 实际的磁盘分区状态
NAME            MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda               8:0    0   40G  0 disk
├─sda1            8:1    0    2M  0 part
├─sda2            8:2    0    1G  0 part /boot
├─sda3            8:3    0   30G  0 part
│ ├─centos-root 253:0    0   10G  0 lvm  /
│ ├─centos-swap 253:1    0    1G  0 lvm  [SWAP]
│ └─centos-home 253:2    0    5G  0 lvm  /home
├─sda4            8:4    0    1G  0 part
├─sda5            8:5    0    1G  0 part
└─sda6            8:6    0  500M  0 part
[root@study ~]# cat /proc/partitions # 内核的分区纪录
major minor  #blocks  name

  11        0    7413760 sr0
   8        0   41943040 sda
   8        1       2048 sda1
   8        2    1048576 sda2
   8        3   31461376 sda3
   8        4    1048576 sda4
   8        5    1048576 sda5
   8        6     512000 sda6
 253        0   10485760 dm-0
 253        1    1048576 dm-1
 253        2    5242880 dm-2

```

##### 用 gdisk 删除一个分区槽

```shell
[root@study ~]# gdisk /dev/sda
Command (? for help): p
Disk /dev/sda: 83886080 sectors, 40.0 GiB
Logical sector size: 512 bytes
Disk identifier (GUID): 3FFD7B58-862B-4A61-A42B-2B31DC5B34C3
Partition table holds up to 128 entries
First usable sector is 34, last usable sector is 83886046
Partitions will be aligned on 2048-sector boundaries
Total free space is 13643709 sectors (6.5 GiB)

Number  Start (sector)    End (sector)  Size       Code  Name
   1            2048            6143   2.0 MiB     EF02
   2            6144         2103295   1024.0 MiB  0700
   3         2103296        65026047   30.0 GiB    8E00
   4        65026048        67123199   1024.0 MiB  8300  Linux filesystem
   5        67123200        69220351   1024.0 MiB  0700  Microsoft basic data
   6        69220352        70244351   500.0 MiB   8200  Linux swap

Command (? for help): d
Partition number (1-6): 6

Command (? for help): p
Disk /dev/sda: 83886080 sectors, 40.0 GiB
Logical sector size: 512 bytes
Disk identifier (GUID): 3FFD7B58-862B-4A61-A42B-2B31DC5B34C3
Partition table holds up to 128 entries
First usable sector is 34, last usable sector is 83886046
Partitions will be aligned on 2048-sector boundaries
Total free space is 14667709 sectors (7.0 GiB)

Number  Start (sector)    End (sector)  Size       Code  Name
   1            2048            6143   2.0 MiB     EF02
   2            6144         2103295   1024.0 MiB  0700
   3         2103296        65026047   30.0 GiB    8E00
   4        65026048        67123199   1024.0 MiB  8300  Linux filesystem
   5        67123200        69220351   1024.0 MiB  0700  Microsoft basic data

Command (? for help): w

Final checks complete. About to write GPT data. THIS WILL OVERWRITE EXISTING
PARTITIONS!!

Do you want to proceed? (Y/N): y
OK; writing new GUID partition table (GPT) to /dev/sda.
Warning: The kernel is still using the old partition table.
The new table will be used at the next reboot.
The operation has completed successfully.

[root@study ~]# partprobe -s
/dev/sda: gpt partitions 1 2 3 4 5
Warning: 无法以读写方式打开 /dev/sr0 (只读文件系统)。/dev/sr0 已按照只读方式打开。
Warning: 无法以读写方式打开 /dev/sr0 (只读文件系统)。/dev/sr0 已按照只读方式打开。
Warning: 无法以读写方式打开 /dev/sr0 (只读文件系统)。/dev/sr0 已按照只读方式打开。
[root@study ~]# lsblk
NAME            MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda               8:0    0   40G  0 disk
├─sda1            8:1    0    2M  0 part
├─sda2            8:2    0    1G  0 part /boot
├─sda3            8:3    0   30G  0 part
│ ├─centos-root 253:0    0   10G  0 lvm  /
│ ├─centos-swap 253:1    0    1G  0 lvm  [SWAP]
│ └─centos-home 253:2    0    5G  0 lvm  /home
├─sda4            8:4    0    1G  0 part
└─sda5            8:5    0    1G  0 part
sr0              11:0    1  7.1G  0 rom  /run/media/daihongli/CentOS 7 x86_64
```

<span style="background:#ff4d4f">万分注意！不要去处理一个正在使用中的分区槽！例如，我们的系统现在已经使用了  /dev/vda2 ，那如果你要删除 /dev/vda2 的话， 必须要先将 /dev/vda2 卸除，否则直接删除该分区的话，虽然磁盘还是慧写入正确的分区信息，但是核心会无法更新分区表的信息的！ 另外，文件系统与 Linux 系统的稳定度，恐怕也会变得怪怪的！反正！千万不要处理正在活动文件系统就对了！</span>


#### fdisk
disk 跟 gdisk 使用的方式几乎一样, 只是一个使用 ? 作为指令提示数据，一个使用 m 作为提示, fdisk 有时会使用磁柱 (cylinder) 作为分区的最小单位，与 gdisk 默认使用sector, 另外，MBR 分区是有限制的 (Primary, Extended, Logical...)

```shell
[root@study ~]# fdisk /dev/sda
Command (m for help): m <== 输入 m 后，就会看到底下这些指令介绍
Command action
a toggle a bootable flag
b edit bsd disklabel
c toggle the dos compatibility flag
d delete a partition <==删除一个 partition
l list known partition types
m print this menu
n add a new partition <==新增一个 partition
o create a new empty DOS partition table
p print the partition table <==在屏幕上显示分区表
q quit without saving changes <==不储存离开 fdisk 程序
s create a new empty Sun disklabel
t change a partition's system id
u change display/entry units
v verify the partition table
w write table to disk and exit <==将刚刚的动作写入分区表
x extra functionality (experts only)
```


### 磁盘格式化(建置文件系统)-mkfs

mkfs -make filesystem, 这个指令其实是个综合的指令, 不同文件系统有不同指令，mkfs.xfs，mkfs.exts4.

#### XFS 文件系统 mkfs.xfs

```shell
[root@study ~]# mkfs.xfs [-b bsize] [-d parms] [-i parms] [-l parms] [-L label] [-f] [-r parms] 装置名称
选项与参数：
关于单位：底下只要谈到『数值』时，没有加单位则为 bytes 值，可以用 k,m,g,t,p (小写)等来解释
比较特殊的是 s 这个单位，它指的是 sector 的『个数』喔！
-b ：后面接的是 block 容量，可由 512 到 64k，不过最大容量限制为 Linux 的 4k 喔！
-d ：后面接的是重要的 data section 的相关参数值，主要的值有：
	agcount=数值 ：设定需要几个储存群组的意思(AG)，通常与 CPU 有关
	agsize=数值  ：每个 AG 设定为多少容量的意思，通常 agcount/agsize 只选一个设定即可
	file        ：指的是『格式化的设备是个文件而不是个设备』的意思！(例如虚拟磁盘)
	size=数值 ：data section 的容量，亦即你可以不将全部的设备容量用完的意思
	su=数值 ：当有 RAID 时，那个 stripe 数值的意思，与底下的 sw 搭配使用
	sw=数值 ：当有 RAID 时，用于储存数据的磁盘数量(须扣除备份盘与备用盘)
	sunit=数值 ：与 su 相当，不过单位使用的是『几个 sector(512bytes 大小)』的意思
	swidth=数值 ：就是 su*sw 的数值，但是以『几个 sector(512bytes 大小)』来设定
-f ：如果装置内已经有文件系统，则需要使用这个 -f 来强制格式化才行！
-i ：与 inode 有较相关的设定，主要的设定值有：
	size=数值 ：最小是 256bytes 最大是 2k，一般保留 256 就足够使用了！
	internal=[0|1]：log 装置是否为内建？预设为 1 内建，如果要用外部装置，使用底下设定
	logdev=device ：log 设备为后面接的那个设备上面的意思，需设定 internal=0 才可！
	size=数值 ：指定这块登录区的容量，通常最小得要有 512 个 block，大约 2M 以上才行！
-L ：后面接这个文件系统的标头名称 Label name 的意思！
-r ：指定 realtime section 的相关设定值，常见的有：
	extsize=数值 ：就是那个重要的 extent 数值，一般不须设定，但有 RAID 时，
	最好设定与 swidth 的数值相同较佳！最小为 4K 最大为 1G 。


范例：将前一小节分区出来的 /dev/vda4 格式化为 xfs 文件系统
[root@study ~]# lsblk -f
NAME            FSTYPE     LABEL           UUID                                   MOUNTPOINT
sda
├─sda1
├─sda2          xfs                        d3dd9ff1-827d-4ac1-9fe6-f3ab1e7b0f5e   /boot
├─sda3          LVM2_membe                 Kl0wqu-160U-6TsW-gegq-6Q6h-2qaa-D2IAky
│ ├─centos-root xfs                        651095ce-e0d7-4cd9-a92b-0f22cf4cda3b   /
│ ├─centos-swap swap                       706e61e3-bf3e-4527-8c75-38a1d71b6cab   [SWAP]
│ └─centos-home xfs                        3a20c2fb-2603-40da-a193-a740ea225e42   /home
├─sda4
└─sda5

[root@study ~]# mkfs.xfs /dev/sda4
meta-data=/dev/sda4              isize=256    agcount=4, agsize=65536 blks
         =                       sectsz=512   attr=2, projid32bit=1
         =                       crc=0        finobt=0
data     =                       bsize=4096   blocks=262144, imaxpct=25
         =                       sunit=0      swidth=0 blks
naming   =version 2              bsize=4096   ascii-ci=0 ftype=0
log      =internal log           bsize=4096   blocks=2560, version=2
         =                       sectsz=512   sunit=0 blks, lazy-count=1
realtime =none                   extsz=4096   blocks=0, rtextents=0

[root@study ~]# lsblk  -f
NAME            FSTYPE     LABEL           UUID                                   MOUNTPOINT
sda
├─sda1
├─sda2          xfs                        d3dd9ff1-827d-4ac1-9fe6-f3ab1e7b0f5e   /boot
├─sda3          LVM2_membe                 Kl0wqu-160U-6TsW-gegq-6Q6h-2qaa-D2IAky
│ ├─centos-root xfs                        651095ce-e0d7-4cd9-a92b-0f22cf4cda3b   /
│ ├─centos-swap swap                       706e61e3-bf3e-4527-8c75-38a1d71b6cab   [SWAP]
│ └─centos-home xfs                        3a20c2fb-2603-40da-a193-a740ea225e42   /home
├─sda4          xfs                        cf49ac5f-f878-4949-9345-f73a8266c19a
└─sda5
[root@study ~]# blkid /dev/sda4
/dev/sda4: UUID="cf49ac5f-f878-4949-9345-f73a8266c19a" TYPE="xfs" PARTLABEL="Linux filesystem" PARID="fdef7d45-c71a-42b8-bed1-f547633e3831"

```

范例二：找出你系统的 CPU 数，并据以设定你的 agcount 数值
```shell
[root@study ~]# grep 'processor' /proc/cpuinfo
processor : 0
processor : 1
# 所以就是有两颗 CPU 的意思，那就来设定设定我们的 xfs 文件系统格式化参数吧！！
[root@study ~]# mkfs.xfs -f -d agcount=2 /dev/sda4
meta-data=/dev/sda4              isize=256    agcount=2, agsize=131072 blks
         =                       sectsz=512   attr=2, projid32bit=1
         =                       crc=0        finobt=0
data     =                       bsize=4096   blocks=262144, imaxpct=25
         =                       sunit=0      swidth=0 blks
naming   =version 2              bsize=4096   ascii-ci=0 ftype=0
log      =internal log           bsize=4096   blocks=2560, version=2
         =                       sectsz=512   sunit=0 blks, lazy-count=1
realtime =none                   extsz=4096   blocks=0, rtextents=0

# 可以跟前一个范例对照看看，可以发现 agcount 变成 2 了喔！
# 此外，因为已经格式化过一次，因此 mkfs.xfs 可能会出现不给你格式化的警告！因此需要使用 -f
```

#### XFS 文件系统 for RAID 效能优化 (Optional)

磁盘阵列是多颗磁盘组成一颗大磁盘的意思， 利用同步写入到这些磁盘的技术，不但可以加快读写速度，还可以让某一颗磁盘坏掉时，整个文件系统还是可以持续运作的状态！那就是所谓的容错。

磁盘阵列 (RAID) 就是透过将文件先细分为数个小型的分区区块 (stripe) 之后，然后将众多的 stripes 分别放到磁盘阵列里面的所有磁盘， 所以一个文件是被同时写入到多个磁盘去，当然效能会好一些。为了文件的保全性，所以在这些磁盘里面， 会保留数个 (与磁盘阵列的规划有关) 备份磁盘 (parity disk)，以及可 能会保留一个以上的备用磁盘 (spare disk)，这些区块基本上会占用掉磁盘阵列的总容量，不过对于数据的保全会比较有保障！

分区区块 stripe 的数值大多介于 4K 到 1M 之间，这与你的磁盘阵列卡支持的项目有关。stripe与你的文件数据容量以及效能相关性较高。 当你的系统大多是大型文件时，一般建议 stripe 可以设定大一些，这样磁盘阵列读/写的频率会降低，效能会提升。如果是用于系统， 那么小文件比较多的情况下， stripe 建议大约在 64K 左右可能会有较佳的效能。

优化情境假设：
- 我有2个线程的 CPU 数量，所以 agcount 最好指定为 2  
- 当初设定 RAID 的 stripe 指定为 256K 这么大，因此 su 最好设定为 256k  
- 设定的磁盘阵列有 8 颗，因为是 RAID5 的设定，所以有一个 parity (备份盘)，因此指定 sw 为 7  
- 由上述的数据中，我们可以发现数据宽度 (swidth) 应该就是 256K\*7 得到 1792K，可以指定 extsize 为1792k
```shell
[root@study ~]# mkfs.xfs -f -d agcount=2,su=256k,sw=7 -r extsize=1792k /dev/sda4
meta-data=/dev/sda4              isize=256    agcount=2, agsize=131072 blks
         =                       sectsz=512   attr=2, projid32bit=1
         =                       crc=0        finobt=0
data     =                       bsize=4096   blocks=262144, imaxpct=25
         =                       sunit=64     swidth=448 blks
naming   =version 2              bsize=4096   ascii-ci=0 ftype=0
log      =internal log           bsize=4096   blocks=2560, version=2
         =                       sectsz=512   sunit=64 blks, lazy-count=1
realtime =none                   extsz=1835008 blocks=0, rtextents=0

```

结果分析： sunit 结果是 64 个 block，因为每个 block 为 4K，所以算出来容量就是 256K 也没错！ 那个 swidth 也相同！使用 448 * 4K 得到 1792K！那个 extsz 则是算成 bytes 的单位，换算结果也没错啦！上面是个方式，那如果使用 sunit 与 swidth 直接套用在mkfs.xfs 当中呢？那你得小心了！因为指令中的这两个参数用的是『几个 512bytes 的 sector 数量』的意思！ 是『数量』单位而不是『容量』单位！因此先计算为：  
- sunit = 256K/512byte\*1024(bytes/K) = 512 个 sector  
- swidth = 7 个磁盘 * sunit = 7 * 512 = 3584 个 sector

所以指令就得要变成如下模样：

```shells
[root@study ~]# mkfs.xfs -f -d agcount=2,sunit=512,swidth=3584 -r extsize=1792k /dev/sda4
```

#### EXT4 文件系统 mkfs.ext4

```shell
[root@study ~]# mkfs.ext4 [-b size] [-L label] 装置名称
选项与参数：
-b ：设定 block 的大小，有 1K, 2K, 4K 的容量，
-L ：后面接这个装置的标头名称。

范例：将 /dev/vda5 格式化为 ext4 文件系统
[root@study ~]# mkfs.ext4 /dev/sda5
mke2fs 1.42.9 (28-Dec-2013)
文件系统标签= # Filesystem label 显示 Label name
OS type: Linux
块大小=4096 (log=2) # 每一个 block 的大小
分块大小=4096 (log=2)
Stride=0 blocks, Stripe width=0 blocks  # 跟 RAID 相关性较高
65536 inodes, 262144 blocks  # 总计 inode/block 的数量13107 blocks (5.00%) reserved for the super user
13107 blocks (5.00%) reserved for the super user
第一个数据块=0
Maximum filesystem blocks=268435456
8 block groups # 共有 8 个 block groups 喔！
32768 blocks per group, 32768 fragments per group
8192 inodes per group
Superblock backups stored on blocks:
        32768, 98304, 163840, 229376

Allocating group tables: 完成
正在写入inode表: 完成
Creating journal (8192 blocks): 完成
Writing superblocks and filesystem accounting information: 完成

[root@study ~]# dumpe2fs -h /dev/sda5
dumpe2fs 1.42.9 (28-Dec-2013)
Filesystem volume name:   <none>
Last mounted on:          <not available>
Filesystem UUID:          c86b2822-a4b6-479b-9930-7165119a90a7
Filesystem magic number:  0xEF53
Filesystem revision #:    1 (dynamic)
Filesystem features:      has_journal ext_attr resize_inode dir_index filetype extent 64bit flex_bg sparse_super large_file huge_file uninit_bg dir_nlink extra_isize
Filesystem flags:         signed_directory_hash
Default mount options:    user_xattr acl
Filesystem state:         clean
Errors behavior:          Continue
Filesystem OS type:       Linux
Inode count:              65536
Block count:              262144
Reserved block count:     13107
Free blocks:              249189
Free inodes:              65525
First block:              0
Block size:               4096
Fragment size:            4096
Group descriptor size:    64
Reserved GDT blocks:      127
Blocks per group:         32768
Fragments per group:      32768
Inodes per group:         8192
Inode blocks per group:   512
Flex block group size:    16
Filesystem created:       Sun Jan 28 09:44:00 2024
Last mount time:          n/a
Last write time:          Sun Jan 28 09:44:01 2024
Mount count:              0
Maximum mount count:      -1
Last checked:             Sun Jan 28 09:44:00 2024
Check interval:           0 (<none>)
Lifetime writes:          33 MB
Reserved blocks uid:      0 (user root)
Reserved blocks gid:      0 (group root)
First inode:              11
Inode size:               256
Required extra isize:     28
Desired extra isize:      28
Journal inode:            8
Default directory hash:   half_md4
Directory Hash Seed:      3d2850c0-8600-4164-a5d4-6345dfd78a79
Journal backup:           inode blocks
Journal features:         (none)
日志大小:             32M
Journal length:           8192
Journal sequence:         0x00000001
Journal start:            0


Group 0: (Blocks 0-32767)
  Checksum 0x19b7, unused inodes 8181
  主 superblock at 0, Group descriptors at 1-1
  保留的GDT块位于 2-128
  Block bitmap at 129 (+129), Inode bitmap at 145 (+145)
  Inode表位于 161-672 (+161)
  28521 free blocks, 8181 free inodes, 2 directories, 8181个未使用的inodes
  可用块数: 142-144, 153-160, 4258-32767
  可用inode数: 12-8192
Group 1: (Blocks 32768-65535) [INODE_UNINIT]
  Checksum 0xfedb, unused inodes 8192
  备份 superblock at 32768, Group descriptors at 32769-32769
  保留的GDT块位于 32770-32896
  Block bitmap at 130 (bg #0 + 130), Inode bitmap at 146 (bg #0 + 146)
  Inode表位于 673-1184 (bg #0 + 673)
  32639 free blocks, 8192 free inodes, 0 directories, 8192个未使用的inodes
  可用块数: 32897-65535
  可用inode数: 8193-16384
Group 2: (Blocks 65536-98303) [INODE_UNINIT, BLOCK_UNINIT]
  Checksum 0x4b16, unused inodes 8192
  Block bitmap at 131 (bg #0 + 131), Inode bitmap at 147 (bg #0 + 147)
  Inode表位于 1185-1696 (bg #0 + 1185)
  32768 free blocks, 8192 free inodes, 0 directories, 8192个未使用的inodes
  可用块数: 65536-98303
  可用inode数: 16385-24576
Group 3: (Blocks 98304-131071) [INODE_UNINIT]
  Checksum 0xa615, unused inodes 8192
  备份 superblock at 98304, Group descriptors at 98305-98305
  保留的GDT块位于 98306-98432
  Block bitmap at 132 (bg #0 + 132), Inode bitmap at 148 (bg #0 + 148)
  Inode表位于 1697-2208 (bg #0 + 1697)
  32639 free blocks, 8192 free inodes, 0 directories, 8192个未使用的inodes
  可用块数: 98433-131071
  可用inode数: 24577-32768
Group 4: (Blocks 131072-163839) [INODE_UNINIT]
  Checksum 0xb596, unused inodes 8192
  Block bitmap at 133 (bg #0 + 133), Inode bitmap at 149 (bg #0 + 149)
  Inode表位于 2209-2720 (bg #0 + 2209)
  24576 free blocks, 8192 free inodes, 0 directories, 8192个未使用的inodes
  可用块数: 139264-163839
  可用inode数: 32769-40960
Group 5: (Blocks 163840-196607) [INODE_UNINIT]
  Checksum 0x8758, unused inodes 8192
  备份 superblock at 163840, Group descriptors at 163841-163841
  保留的GDT块位于 163842-163968
  Block bitmap at 134 (bg #0 + 134), Inode bitmap at 150 (bg #0 + 150)
  Inode表位于 2721-3232 (bg #0 + 2721)
  32639 free blocks, 8192 free inodes, 0 directories, 8192个未使用的inodes
  可用块数: 163969-196607
  可用inode数: 40961-49152
Group 6: (Blocks 196608-229375) [INODE_UNINIT, BLOCK_UNINIT]
  Checksum 0x3295, unused inodes 8192
  Block bitmap at 135 (bg #0 + 135), Inode bitmap at 151 (bg #0 + 151)
  Inode表位于 3233-3744 (bg #0 + 3233)
  32768 free blocks, 8192 free inodes, 0 directories, 8192个未使用的inodes
  可用块数: 196608-229375
  可用inode数: 49153-57344
Group 7: (Blocks 229376-262143) [INODE_UNINIT]
  Checksum 0x1789, unused inodes 8192
  备份 superblock at 229376, Group descriptors at 229377-229377
  保留的GDT块位于 229378-229504
  Block bitmap at 136 (bg #0 + 136), Inode bitmap at 152 (bg #0 + 152)
  Inode表位于 3745-4256 (bg #0 + 3745)
  32639 free blocks, 8192 free inodes, 0 directories, 8192个未使用的inodes
  可用块数: 229505-262143
  可用inode数: 57345-65536
```

#### 其他文件系统 mkfs

mkfs 其实是个综合指令而已，当我们使用 mkfs -t xfs 时，它就会跑去找 mkfs.xfs 相关的参数给我们使用！ 如果想要知道系统还支持哪种文件系统的格式化功能，直接按 \[tabl] 就很清楚了！

```shell
[root@study ~]# mkfs[tab][tab]
mkfs mkfs.btrfs mkfs.cramfs mkfs.ext2 mkfs.ext3 mkfs.ext4
mkfs.fat mkfs.minix mkfs.msdos mkfs.vfat mkfs.xfs
```


### 文件系统检验

#### xfs_repair 处理 XFS 文件系统  

当有 xfs 文件系统错乱才需要使用这个指令！所以，这个指令最好是不要用到啦！但有问题发生时，这个指令却又很重要

```shell
[root@study ~]# xfs_repair [-fnd] 装置名称
选项与参数：
-f ：后面的装置其实是个文件而不是实体设备
-n ：单纯检查并不修改文件系统的任何数据 (检查而已)
-d ：通常用在单人维护模式底下，针对根目录 (/) 进行检查与修复的动作！很危险！不要随便使用
范例：检查一下刚刚建立的 /dev/vda4 文件系统
[root@study ~]# xfs_repair /dev/sda4
Phase 1 - find and verify superblock...
Phase 2 - using internal log
        - zero log...
        - scan filesystem freespace and inode maps...
        - found root inode chunk
Phase 3 - for each AG...
        - scan and clear agi unlinked lists...
        - process known inodes and perform inode discovery...
        - agno = 0
        - agno = 1
        - process newly discovered inodes...
Phase 4 - check for duplicate blocks...
        - setting up duplicate extent list...
        - check for inodes claiming duplicate blocks...
        - agno = 0
        - agno = 1
Phase 5 - rebuild AG headers and trees...
        - reset superblock...
Phase 6 - check inode connectivity...
        - resetting contents of realtime bitmap and summary inodes
        - traversing filesystem ...
        - traversal finished ...
        - moving disconnected inodes to lost+found ...
Phase 7 - verify and correct link counts...
done
# 共有 7 个重要的检查流程！详细的流程介绍可以 man xfs_repair 即可！
范例：检查一下系统原本就有的 /dev/centos/home 文件系统
[root@study ~]# xfs_repair /dev/centos/home
xfs_repair: /dev/centos/home contains a mounted filesystem
xfs_repair: /dev/centos/home contains a mounted and writable filesystem
fatal error -- couldn't initialize XFS library
```

xfs_repair 可以检查/修复文件系统，不过，因为修复文件系统是个很庞大的任务！因此，修复时该文件系统不能被挂载！ 所以，检查与修复 /dev/vda4 没啥问题，但是修复 /dev/centos/home 这个已经挂载的文件系统时，就出现上述的问题了！ 没关系，若可以卸除，卸除后再处理即可。

Linux 系统有个装置无法被卸除，那就是根目录啊！如果你的根目录有问题怎办？这时得要进入单人维护或救援模式，然后透过 -d 这个选项来处理！ 加入 -d 这个选项后，系统会强制检验该装置，检验完毕后就会自动重新启动啰！不过，鸟哥完全不打算要进行这个指令的实做... 永远都不希望实做这东西...

#### fsck.ext4 处理 EXT4 文件系统

fsck 是个综合指令，如果是针对 ext4 的话，建议直接使用 fsck.ext4 来检测比较妥当！那 fsck.ext4的选项有底下几个常见的项目：

```shell
[root@study ~]# fsck.ext4 [-pf] [-b superblock] 装置名称
选项与参数：
-p ：当文件系统在修复时，若有需要回复 y 的动作时，自动回复 y 来继续进行修复动作。
-f ：强制检查！一般来说，如果 fsck 没有发现任何 unclean 的标识，不会主动进入详细检查的，如果您想要强制 fsck 进入详细检查，就得加上 -f 标识
-D ：针对文件系统下的目录进行优化配置。
-b ：后面接 superblock 的位置！一般来说这个选项用不到。但是如果你的 superblock 因故损毁时，透过这个参数即可利用文件系统内备份的 superblock 来尝试救援。一般来说，superblock 备份在：1K block 放在 8193, 2K block 放在 16384, 4K block 放在 32768

范例：找出刚刚建置的 /dev/sda5 的另一块 superblock，并据以检测系统
[root@study ~]# dumpe2fs -h /dev/sda5 |grep 'Blocks per group'
dumpe2fs 1.42.9 (28-Dec-2013)
Blocks per group:         32768
# 看起来每个 block 群组会有 32768 个 block，因此第二个 superblock 应该就在 32768 上！
# 因为 block 号码为 0 号开始编的！
[root@study ~]# fsck.ext4 -b 32768 /dev/sda5
e2fsck 1.42.9 (28-Dec-2013)
/dev/sda5 was not cleanly unmounted, 强制检查.
第一步: 检查inode,块,和大小
第二步: 检查目录结构
第3步: 检查目录连接性
Pass 4: Checking reference counts
第5步: 检查簇概要信息
/dev/sda5: ***** 文件系统已修改 *****  # 文件系统被改过，所以这里会有警告！
/dev/sda5: 11/65536 files (0.0% non-contiguous), 12955/262144 blocks

[root@study ~]# fsck.ext4 -b 32768 /dev/vda5
e2fsck 1.42.9 (28-Dec-2013)
/dev/vda5 was not cleanly unmounted, check forced.
Pass 1: Checking inodes, blocks, and sizes
Deleted inode 1577 has zero dtime. Fix<y>? yes
Pass 2: Checking directory structure
Pass 3: Checking directory connectivity
Pass 4: Checking reference counts
Pass 5: Checking group summary information
/dev/vda5: ***** FILE SYSTEM WAS MODIFIED ***** # 文件系统被改过，所以这里会有警告！
/dev/vda5: 11/65536 files (0.0% non-contiguous), 12955/262144 blocks
# 好巧合！鸟哥使用这个方式来检验系统，恰好遇到文件系统出问题！于是可以有比较多的解释方向！
# 当文件系统出问题，它就会要你选择是否修复～如果修复如上所示，按下 y 即可！
# 最终系统会告诉你，文件系统已经被更改过，要注意该项目的意思！

范例：已预设设定强制检查一次 /dev/vda5
[root@study ~]# fsck.ext4 /dev/sda5
e2fsck 1.42.9 (28-Dec-2013)
/dev/sda5: clean, 11/65536 files, 12955/262144 blocks

[root@study ~]# fsck.ext4 -f /dev/sda5
e2fsck 1.42.9 (28-Dec-2013)
第一步: 检查inode,块,和大小
第二步: 检查目录结构
第3步: 检查目录连接性
Pass 4: Checking reference counts
第5步: 检查簇概要信息
/dev/sda5: 11/65536 files (0.0% non-contiguous), 12955/262144 blocks

[root@study ~]# fsck.ext4 /dev/sda5
e2fsck 1.42.9 (28-Dec-2013)
/dev/vda5: clean, 11/65536 files, 12955/262144 blocks
# 文件系统状态正常，它并不会进入强制检查！会告诉你文件系统没问题 (clean)
[root@study ~]# fsck.ext4 -f /dev/sda5
e2fsck 1.42.9 (28-Dec-2013)
Pass 1: Checking inodes, blocks, and sizes
....(底下省略)
```

<span style="background:rgba(255, 183, 139, 0.55)"><font color="#0c0c0c"> xfs_repair 或 fsck.ext4，这都是用来检查与修正文件系统错误的指令。注意：要root权限，并且系统出问题时用，否则在正常状况下使用此一指令， 可能会造成对系统的危害！通常使用这个指令的场合都是在系统出现极大的问题，导致你在 Linux 开机的时候得进入单人单机模式下进行维护的行为时，才必须使用此一指令！另外，如果你怀疑刚刚格式化成功的磁盘有问题的时后，也可以使用 xfs_repair/fsck.ext4 来检查一磁盘呦！其实就有点像是 Windows 的 scandisk 啦！此外，由于 xfs_repair/fsck.ext4 在扫瞄磁盘的时候，可能会造成部分 filesystem 的修订，所以执行 xfs_repair/fsck.ext4 时， 被检查的 partition 务必不可挂载到系统上！亦即是需要在卸除的状态！</font></span>


### 文件系统挂载与卸除

挂载点是目录，而且目录是进入文件系统（磁盘分区槽）的入口，挂在前要确认：
- 单一文件系统不应该被重复挂载在不同的挂载点(目录)中；  
- **单一目录不应该重复挂载多个文件系统；**  
- **要作为挂载点的目录，理论上应该都是空目录才是。**

尤其是上述的后两点！如果你要用来挂载的目录里面并不是空的，那么挂载了文件系统之后，原目录下的东西就会暂时的消失。举个例子来说，假设你的 /home 原本与根目录 (/) 在同一个文件系统中，底下原本就有 /home/test 与 /home/vbird 两个目录。然后你想要加入新的磁盘，并且直接挂载 /home底下，那么当你挂载上新的分区槽时，则 /home 目录显示的是新分区槽内的资料，至于原先的 test 与vbird 这两个目录就会暂时的被隐藏掉了！注意喔！并不是被覆盖掉， 而是暂时的隐藏了起来，等到新分区槽被卸除之后，则 /home 原本的内容就会再次的跑出来


#### mount挂载命令

```shell
[root@study ~]# mount -a
[root@study ~]# mount [-l]
[root@study ~]# mount [-t 文件系统] LABEL='' 挂载点
[root@study ~]# mount [-t 文件系统] UUID='' 挂载点 # 鸟哥近期建议用这种方式喔！
[root@study ~]# mount [-t 文件系统] 装置文件名 挂载点
选项与参数：
-a ：依照配置文件 /etc/fstab 的数据将所有未挂载的磁盘都挂载上来
-l ：单纯的输入 mount 会显示目前挂载的信息。加上 -l 可增列 Label 名称！
-t ：可以加上文件系统种类来指定欲挂载的类型。常见的 Linux 支持类型有：xfs, ext3, ext4,
	reiserfs, vfat, iso9660(光盘格式), nfs, cifs, smbfs (后三种为网络文件系统类型)
-n ：在默认的情况下，系统会将实际挂载的情况实时写入 /etc/mtab 中，以利其他程序的运作。
	但在某些情况下(例如单人维护模式)为了避免问题会刻意不写入。此时就得要使用 -n 选项。
-o ：后面可以接一些挂载时额外加上的参数！比方说账号、密码、读写权限等：
	async, sync: 此文件系统是否使用同步写入 (sync) 或异步 (async) 的
	内存机制，请参考文件系统运作方式。预设为 async。
	atime,noatime: 是否修订文件的读取时间(atime)。为了效能，某些时刻可使用 noatime
	ro, rw: 挂载文件系统成为只读(ro) 或可擦写(rw)
	auto, noauto: 允许此 filesystem 被以 mount -a 自动挂载(auto)
	dev, nodev: 是否允许此 filesystem 上，可建立装置文件？ dev 为可允许
	suid, nosuid: 是否允许此 filesystem 含有 suid/sgid 的文件格式？
	exec, noexec: 是否允许此 filesystem 上拥有可执行 binary 文件？
	user, nouser: 是否允许此 filesystem 让任何使用者执行 mount ？一般来说，
		mount 仅有 root 可以进行，但下达 user 参数，则可让
		一般 user 也能够对此 partition 进行 mount 。
defaults: 默认值为：rw, suid, dev, exec, auto, nouser, and async
remount: 重新挂载，这在系统出错，或重新更新参数时，很有用！
```

你不需要加上 -t 这个选项，系统会自动的分析最恰当的文件系统来尝试挂载你需要的装置！ 这也是使用 blkid 就能够显示正确的文件系统的缘故！由于文件系统几乎都有 superblock ，Linux 可以透过分析superblock 搭配 Linux 自己的驱动程序去测试挂载， 如果成功的套和了，就立刻自动的使用该类型的文件系统挂载起来！那么系统有没有指定哪些类型的 filesystem 才需要进行上述的挂载测试呢？主要是参考底下这两个文件：
- /etc/filesystems：系统指定的测试挂载文件系统类型的优先级；
- /proc/filesystems：Linux 系统已经加载的文件系统类型

Linux 支持的文件系统之驱动程序都写在如下的目录中：  
- /lib/modules/$(uname -r)/kernel/fs/


#### 挂载xfs/ext4/vfat 等文件系统

```shell
范例：找出 /dev/vda4 的 UUID 后，用该 UUID 来挂载文件系统到 /data/xfs 内
[root@study ~]# blkid /dev/vda4
/dev/vda4: UUID="e0a6af55-26e7-4cb7-a515-826a8bd29e90" TYPE="xfs"
[root@study ~]# mount UUID="e0a6af55-26e7-4cb7-a515-826a8bd29e90" /data/xfs
mount: mount point /data/xfs does not exist # 非正规目录！所以手动建立它！
[root@study ~]# mkdir -p /data/xfs
[root@study ~]# mount UUID="e0a6af55-26e7-4cb7-a515-826a8bd29e90" /data/xfs
[root@study ~]# df /data/xfs
Filesystem 1K-blocks Used Available Use% Mounted on
/dev/vda4 1038336 32864 1005472 4% /data/xfs
# 顺利挂载，且容量约为 1G 左右没问题！
范例：使用相同的方式，将 /dev/vda5 挂载于 /data/ext4
[root@study ~]# blkid /dev/vda5
/dev/vda5: UUID="899b755b-1da4-4d1d-9b1c-f762adb798e1" TYPE="ext4"
[root@study ~]# mkdir /data/ext4
[root@study ~]# mount UUID="899b755b-1da4-4d1d-9b1c-f762adb798e1" /data/ext4
[root@study ~]# df /data/ext4
Filesystem 1K-blocks Used Available Use% Mounted on
/dev/vda5 999320 2564 927944 1% /data/ext4
```

#### 挂载 CD 或 DVD 光盘

```shell
范例：将你用来安装 Linux 的 CentOS 原版光盘拿出来挂载到 /data/cdrom！
[root@study ~]# blkid
.....(前面省略).....
/dev/sr0: UUID="2015-04-01-00-21-36-00" LABEL="CentOS 7 x86_64" TYPE="iso9660" PTTYPE="dos"
[root@study ~]# mkdir /data/cdrom
[root@study ~]# mount /dev/sr0 /data/cdrom
mount: /dev/sr0 is write-protected, mounting read-only
[root@study ~]# df /data/cdrom
Filesystem 1K-blocks Used Available Use% Mounted on
/dev/sr0 7413478 7413478 0 100% /data/cdrom
# 怎么会使用掉 100% 呢？是啊！因为是 DVD 啊！所以无法再写入了啊！
```

#### 挂载 vfat 中文U盘

这个U盘不能够是 NTFS 的文件系统

```shell
范例：找出你的随身碟装置的 UUID，并挂载到 /data/usb 目录中
[root@study ~]# blkid
/dev/sda1: UUID="35BC-6D6B" TYPE="vfat"[root@study ~]# mkdir /data/usb
[root@study ~]# mount -o codepage=950,iocharset=utf8 UUID="35BC-6D6B" /data/usb
[root@study ~]# # mount -o codepage=950,iocharset=big5 UUID="35BC-6D6B" /data/usb
[root@study ~]# df /data/usb
Filesystem 1K-blocks Used Available Use% Mounted on
/dev/sda1 2092344 4 2092340 1% /data/usb
```

如果带有中文文件名的数据，那么可以在挂载时指定一下挂载文件系统所使用的语系数据。 在 manmount 找到 vfat 文件格式当中可以使用 codepage 来处理！中文语系的代码为 950 喔！另外，如果想要指定中文是万国码还是大五码， 就得要使用 iocharset 为 utf8 还是 big5 两者择一了！因为鸟哥的随身碟使用 utf8 编码，因此将上述的 big5 前面加上 # 符号

万一你使用的 USB 磁盘被格式化为 NTFS 时，那可能就得要动点手脚，因为预设的 CentOS 7 并没有支持 NTFS 文件系统格式！所以你得要安装 NTFS 文件系统的驱动程序后，才有办法处理的


#### mount -o remount重新挂载根目录与挂载不特定目录

根目录无法被卸载，但如果要**改变挂载参数**，或者根目录出现**只读状态**时，可以重新启动（reboot), 或者下面这样做：
```shell
范例：将 / 重新挂载，并加入参数为 rw 与 auto
[root@study ~]# mount -o remount,rw,auto /
```

重点是那个『 -o remount,xx 』的选项与参数！请注意，要重新挂载 (remount) 时， 这是个非常重要的机制！尤其是当你进入单人维护模式时，你的根目录常会被系统挂载为只读，这个时候这个指令就太重要了！

另外，我们也可以利用 mount 来**将某个目录挂载到另外一个目录去**, 这并不是挂载文件系统，而是额外挂载某个目录的方法！ 虽然底下的方法也可以使用 symbolic link 来连结，不过在某些不支持符号链接的程序运作中，还是得要透过这样的方法才行
```shell
范例：将 /var 这个目录暂时挂载到 /data/var 底下：
[root@study ~]# mkdir /data/var
[root@study ~]# mount --bind /var /data/var
[root@study ~]# ls -lid /var /data/var
16777346 drwxr-xr-x. 22 root root 4096 Jun 15 23:43 /data/var
16777346 drwxr-xr-x. 22 root root 4096 Jun 15 23:43 /var
# 内容完全一模一样啊！因为挂载目录的缘故！
[root@study ~]# mount | grep var
/dev/mapper/centos-root on /data/var type xfs (rw,relatime,seclabel,attr2,inode64,noquota)
```
看起来，其实两者连结到同一个 inode, 透过这个 mount --bind 的功能， 您可以将某个目录挂载到其他目录去喔！而并不是整块 filesystem 的啦！所以从此进入 /data/var 就是进入/var 的意思.

#### umount (将装置文件卸除)

```shell
[root@study ~]# umount [-fn] 装置文件名或挂载点
选项与参数：
-f ：强制卸除！可用在类似网络文件系统 (NFS) 无法读取到的情况下；
-l ：立刻卸除文件系统，比 -f 还强！
-n ：不更新 /etc/mtab 情况下卸除
```

范例：将本章之前自行挂载的文件系统全部卸除：
```shell
[root@study ~]# mount
.....(前面省略).....
/dev/vda4 on /data/xfs type xfs (rw,relatime,seclabel,attr2,inode64,logbsize=256k,sunit=512,..)
/dev/vda5 on /data/ext4 type ext4 (rw,relatime,seclabel,data=ordered)
/dev/sr0 on /data/cdrom type iso9660 (ro,relatime)
/dev/sda1 on /data/usb type vfat (rw,relatime,fmask=0022,dmask=0022,codepage=950,iocharset=...)
/dev/mapper/centos-root on /data/var type xfs (rw,relatime,seclabel,attr2,inode64,noquota)
# 先找一下已经挂载的文件系统，如上所示，特殊字体即为刚刚挂载的装置啰！
# 基本上，卸除后面接装置或挂载点都可以！不过最后一个 centos-root 由于有其他挂载，
# 因此，该项目一定要使用挂载点来卸除才行！
[root@study ~]# umount /dev/vda4 <==用装置文件名来卸除
[root@study ~]# umount /data/ext4 <==用挂载点来卸除
[root@study ~]# umount /data/cdrom <==因为挂载点比较好记忆！
[root@study ~]# umount /data/usb
[root@study ~]# umount /data/var <==一定要用挂载点！因为装置有被其他方式挂载
```

由于通通卸除了，此时你才可以退出光盘片、软盘片、USB 随身碟等设备喔！如果你遇到这样的情况：

```shell
[root@study ~]# mount /dev/sr0 /data/cdrom
[root@study ~]# cd /data/cdrom
[root@study cdrom]# umount /data/cdrom
umount: /data/cdrom: target is busy.(In some cases useful info about processes that use
the device is found by lsof(8) or fuser(1))
[root@study cdrom]# cd /
[root@study /]# umount /data/cdrom
```

由于你目前正在 /data/cdrom/ 的目录内，也就是说其实你**正在使用该文件系统**, 所以自无法卸除！离开该文件系统的挂载点即可。以上述的案例来说， 你可以使用『 cd / 』回到根目录，就能够卸除 /data/cdrom


### 磁盘/文件系统参数自定义

#### mknod

Linux下一切接文件，设备也是文件，是通过文件的 major（主要设备代码） 与 minor（次要设备代码） 数值来区分具体设备类型的。Linux 核心 2.6 版以后，硬件文件名已经都可以被系统自动的实时产生了，我们根本不需要手动建立装置文件。 不过某些情况底下我们可能还是得要手动处理装置文件的，例如在某些服务被chroot到特定目录下时， 就需要这样做了。

| 磁盘文件名 | Major | Minor |
| ---- | ---- | ---- |
| /dev/sda | 8 | 0-15 |
| /dev/sdb | 8 | 16-31 |
| /dev/loop0 | 7 | 0 |
| /dev/loop1 | 7 | 1 |
```shell
[root@study ~]# mknod 设备文件名 [bcp] [Major] [Minor]
选项与参数：
装置种类：
b ：设定设备名称成为一个外接存设备文件，例如磁盘等；
c ：设定设备名称成为一个外接输入设备文件，例如鼠标/键盘等；
p ：设定设备名称成为一个 FIFO 文件；
Major ：主设备代码；
Minor ：次设备代码；

范例：由上述的介绍我们知道 /dev/vda10 装置代码 252, 10，请建立并查阅此装置
[root@study ~]# mknod /dev/vda10 b 252 10
[root@study ~]# ll /dev/vda10
brw-r--r--. 1 root root 252, 10 Jun 24 23:40 /dev/vda10
# 上面那个 252 与 10 是有意义的，不要随意设定啊！

范例：建立一个 FIFO 文件，档名为 /tmp/testpipe
[root@study ~]# mknod /tmp/testpipe p
[root@study ~]# ll /tmp/testpipe
prw-r--r--. 1 root root 0 Jun 24 23:44 /tmp/testpipe
# 注意啊！这个文件可不是一般文件，不可以随便就放在这里！
# 测试完毕之后请删除这个文件吧！看一下这个文件的类型！是 p 喔！^_^
[root@study ~]# rm /dev/vda10 /tmp/testpipe
rm: remove block special file '/dev/vda10' ? y
rm: remove fifo '/tmp/testpipe' ? y
```

#### xfs_admin 修改 XFS 文件系统的 UUID 与 Label name

如果你当初格式化的时候忘记加上标头名称，后来想要再次加入时，不需要重复格式化！直接使用这个 xfs_admin 即可

```shell
root@study ~]# xfs_admin [-lu] [-L label] [-U uuid] 装置文件名
选项与参数：
-l ：列出这个装置的 label name
-u ：列出这个装置的 UUID
-L ：设定这个装置的 Label name-U ：设定这个装置的 UUID 喔！

范例：设定 /dev/vda4 的 label name 为 vbird_xfs，并测试挂载
[root@study ~]# xfs_admin -L vbird_xfs /dev/vda4
writing all SBs
new label = "vbird_xfs" # 产生新的 LABEL 名称啰！
[root@study ~]# xfs_admin -l /dev/vda4
label = "vbird_xfs"
[root@study ~]# mount LABEL=vbird_xfs /data/xfs/

范例：利用 uuidgen 产生新 UUID 来设定 /dev/vda4，并测试挂载
[root@study ~]# umount /dev/vda4 # 使用前，请先卸除！
[root@study ~]# uuidgen
e0fa7252-b374-4a06-987a-3cb14f415488 # 很有趣的指令！可以产生新的 UUID 喔！
[root@study ~]# xfs_admin -u /dev/vda4
UUID = e0a6af55-26e7-4cb7-a515-826a8bd29e90
[root@study ~]# xfs_admin -U e0fa7252-b374-4a06-987a-3cb14f415488 /dev/vda4
Clearing log and setting UUID
writing all SBs
new UUID = e0fa7252-b374-4a06-987a-3cb14f415488
[root@study ~]# mount UUID=e0fa7252-b374-4a06-987a-3cb14f415488 /data/xfs
```

#### tune2fs 修改 ext4 的 label name 与 UUID

```shell
[root@study ~]# tune2fs [-l] [-L Label] [-U uuid] 装置文件名
选项与参数：
-l ：类似 dumpe2fs -h 的功能～将 superblock 内的数据读出来～
-L ：修改 LABEL name
-U ：修改 UUID 啰！

范例：列出 /dev/vda5 的 label name 之后，将它改成 vbird_ext4
[root@study ~]# dumpe2fs -h /dev/vda5 | grep name
dumpe2fs 1.42.9 (28-Dec-2013)Filesystem volume name: <none> # 果然是没有设定的！
[root@study ~]# tune2fs -L vbird_ext4 /dev/vda5
[root@study ~]# dumpe2fs -h /dev/vda5 | grep name
Filesystem volume name: vbird_ext4
[root@study ~]# mount LABEL=vbird_ext4 /data/ext4
```

### 设定开机挂载

#### 开机挂载 /etc/fstab 及 /etc/mtab

系统挂载的一些限制：
- 根目录 / 是必须挂载的﹐而且一定要先于其它挂载点 (mount point) 被挂载进来。  
- 其它 mount point 必须为已建立的目录﹐可任意指定﹐但一定要遵守必须的系统目录架构原则 (FHS)  
- 所有 mount point 在同一时间之内﹐只能挂载一次。  
- 所有硬盘分区 （partition） 在同一时间之内﹐只能挂载一次。  
- 如若进行卸除﹐您必须先将工作目录移到 mount point(及其子目录) 之外。

```shell
[root@study /]# cat /etc/fstab

#
# /etc/fstab
# Created by anaconda on Sat Jan 20 23:03:48 2024
#
# Accessible filesystems, by reference, are maintained under '/dev/disk'
# See man pages fstab(5), findfs(8), mount(8) and/or blkid(8) for more info
#
# Device                                  Mount      point filesystem parameters dump fsck
/dev/mapper/centos-root                   /                  xfs       defaults    0   0
UUID=d3dd9ff1-827d-4ac1-9fe6-f3ab1e7b0f5e /boot              xfs       defaults    0   0
/dev/mapper/centos-home                   /home              xfs       defaults    0   0
/dev/mapper/centos-swap                    swap              swap      defaults    0   0
```

/etc/fstab (filesystem table) 就是将我们利用 mount 指令进行挂载时， 将所有的选项与参数写入到这个文件中。 /etc/fstab 还加入了 dump 这个备份用指令的支持！ 与开机时是否进行文件系统检验 fsck 等指令有关。 这个文件的内容共有六个字段
```shell
[装置/UUID 等] [挂载点] [文件系统] [文件系统参数] [dump] [fsck]
```

o 第一栏：磁盘设备文件名/UUID/LABEL name：  
这个字段可以填写的数据主要有三个项目：  
- 文件系统或磁盘的设备文件名，如 /dev/vda2 等  
- 文件系统的 UUID 名称，如 UUID=xxx  
- 文件系统的 LABEL 名称，例如 LABEL=xxx

o 第二栏：挂载点 (mount point)：：  
就是挂载点，一定是目录

o 第三栏：磁盘分区的文件系统：  
在手动挂载时可以让系统自动测试挂载，但在这个文件当中我们必须要手动写入文件系统才行！包括 xfs, ext4, vfat, reiserfs, nfs 等等。  

o 第四栏：文件系统参数：  
前面示例中『codepage=950,iocharset=utf8』这些特殊的参数就是写入在这个字段

| 参数 | 内容意义 |
| ---- | ---- |
| async/sync  <br>异步/同步 设定磁盘是否以异步方式运作！预设为 async(效能较佳) |  |
|  |  |
| auto/noauto  <br>自动/非自动 | 当下达 mount -a 时，此文件系统是否会被主动测试挂载。预设为 auto。 |
| rw/ro  <br>可擦写/只读 | 让该分区槽以可擦写或者是只读的型态挂载上来，如果你想要分享的数据是不给用  <br>户随意变更的， 这里也能够设定为只读。则不论在此文件系统的文件是否设定 w  <br>权限，都无法写入喔！ |
| exec/noexec  <br>可执行/不可执行 | 限制在此文件系统内是否可以进行『执行』的工作？如果是纯粹用来储存数据的目  <br>录， 那么可以设定为 noexec 会比较安全。不过，这个参数也不能随便使用，因为  <br>你不知道该目录下是否默认会有执行档。  <br>举例来说，如果你将 noexec 设定在 /var ，当某些软件将一些执行文件放置于 /var  <br>下时，那就会产生很大的问题喔！ 因此，建议这个 noexec 最多仅设定于你自定义  <br>或分享的一般数据目录。 |
| user/nouser  <br>允许/不允许使用者挂载 | 是否允许用户使用 mount 指令来挂载呢？一般而言，我们当然不希望一般身份的  <br>user 能使用 mount 啰，因为太不安全了，因此这里应该要设定为 nouser 啰！ |
| suid/nosuid  <br>具有/不具有 suid 权限 | 该文件系统是否允许 SUID 的存在？如果不是执行文件放置目录，也可以设定为  <br>nosuid 来取消这个功能！ |
| defaults | 同时具有 rw, suid, dev, exec, auto, nouser, async 等参数。 基本上，预设情况使用  <br>defaults 设定即可！ |

o 第五栏：能否被 dump 备份指令作用：  
dump 是一个用来做为备份的指令，不过现在有太多的备份方案了，所以这个项目直接输入 0 

o 第六栏：是否以 fsck 检验扇区：  
早期开机的流程中，会有一段时间去检验本机的文件系统，看看文件系统是否完整 (clean)。 不过这个方式使用的主要是透过 fsck 去做的，我们现在用的 xfs 文件系统就没有办法适用，因为 xfs会自己进行检验，不需要额外进行这个动作！所以直接填 0 就好了。

例题：  
假设我们要将 /dev/vda4 每次开机都自动挂载到 /data/xfs ，该如何进行？

```shll
[root@study ~]# blkid /dev/sda4
/dev/sda4: LABEL="vbird_xfs" UUID="3eea6909-0633-4bc4-b125-e1db880db48d" TYPE="xfs" PARTLABEL="Linux filesystem" PARTUUID="fdef7d45-c71a-42b8-bed1-f547633e3831"
[root@study /]# vim /etc/fstab
#[装置/UUID 等]                          [挂载点]         [文件系统]     [文件系统参数] [dump] [fsck]
/dev/mapper/centos-root                   /                 xfs           defaults        0 0
UUID=d3dd9ff1-827d-4ac1-9fe6-f3ab1e7b0f5e /boot             xfs           defaults        0 0
/dev/mapper/centos-home                   /home             xfs           defaults        0 0
/dev/mapper/centos-swap                    swap             swap          defaults        0 0
UUID=3eea6909-0633-4bc4-b125-e1db880db48d /data/xfs         xfs           defaults        0 0

[root@study /]# df /data/xfs/
文件系统         1K-块  已用    可用     已用% 挂载点
/dev/sda4      1038336 32864 1005472    4%   /data/xfs
```

重启后，/dev/sda4还在，/etc/fstab 是开机时的配置文件，不过，实际 filesystem 的挂载是记录到 /etc/mtab 与 /proc/mounts 这两个文件当中的。每次我们在更改 filesystem 的挂载时，也会同时更改这两个文件

#### 单人模式根目录权限只读
在配置/etc/fstab时输入错误数据，导致无法顺利开机，进入单人模式，这时 根目录/是read only的状态，就无法修改/etc/fstab, 也无法更新/etc/mtab. 使用下面的命令使 /变为rw状态。
```shell
[root@study ~]# mount -n -o remount,rw /
```


### 特殊装置 loop 挂载 (映象档不刻录就挂载使用)

#### Loop设备介绍

##### 一、简单介绍

Loop设备是一种块设备，但是它并不指向硬盘或者光驱，而是指向一个文件块或者另一种块设备。

一种应用的例子：将另外一种文件系统的镜像文件保存到一个文件中，例如iso文件，然后将一个Loop设备指向该文件，紧接着就可以通过mount挂载该loop设备到主文件系统的一个目录下了，我们就可以正常访问该镜像中的内容，就像访问一个文件系统一样。

##### 二、详细介绍

loop设备是一种伪设备，是使用文件来模拟块设备的一种技术，文件模拟成块设备后, 就像一个磁盘或光盘一样使用。在使用之前，一个 loop 设备必须要和一个文件进行连接。这种结合方式给用户提供了一个替代块特殊文件的接口。因此，如果这个文件包含有一个完整的文件系统，那么这个文件就可以像一个磁盘设备一样被 mount 起来。之所以叫loop设备（回环），其实是从文件系统这一层来考虑的，**因为这种被 mount 起来的镜像文件它本身也包含有文件系统，通过loop设备把它mount起来，它就像是文件系统之上再绕了一圈的文件系统，所以称为 loop。**

>回环设备（ 'loopback device'）允许用户以一个普通磁盘文件虚拟一个块设备。设想一个磁盘设备，对它的所有读写操作都将被重定向到读写一个名为 disk-image 的普通文件而非操作实际磁盘或分区的轨道和扇区。（当然，disk-image 必须存在于一个实际的磁盘上，而这个磁盘必须比虚拟的磁盘容量更大。）回环设备允许你这样使用一个普通文件。

回环设备以 /dev/loop0、/dev/loop1 等命名。每个设备可虚拟一个块设备。注意只有超级用户才有权限设置回环设备。

##### 三、简单使用

一般在linux中会有8个loop设备，一般是/dev/loop0~loop7，可用通过`losetup -a`查看所有的loop设备，如果命令没有输出就说明所有的loop设备都没有被占用，你可以按照以下步骤创建自己的loop设备。

命令`losetup`可以对loop设备进行操作。

下面简单的说明loop设备映射或者指向一个文件的简单步骤：

```shell
# 创建一个文件
1、dd if=/dev/zero of=/var/loop.img bs=1M count=10240

# 使用losetup将文件转化为块设备
2、losetup /dev/loop0 /var/loop.img

# 通过lsblk查看刚刚创建的块设备
lsblk | grep loop0  
losetup –a

# 3、2步骤过后，我们就获得了一个磁盘，在这
# 首先创建一个目录：
mkdir /myloopdev

# 接着挂载：
mount /dev/loop0 /myloopdev

# 5、就可以进入myloopdev目录，对该虚拟磁盘进行操作了。就像使用真实磁盘一样，例如：echo “hello world!” > hello_world.txt
# 6、使用结束，我们卸载该磁盘，umount /myloopdev
# 7、接着删除该loop设备，losetup –d  /dev/loop0
```


##### 四、使用loop设备完成一些功能

上面三简单介绍了如何使用Loop指向一个文件，接下介绍使用loop的一些场景。
利用Loop设备作为一个虚拟光驱或者虚拟软驱

1、回环设备关联文件。
`losetup /dev/loop0  a.iso`
losetup命令用来实现回环设备和文件的关联。这个命令还可以实现文件系统的加密，有兴趣的朋友可以查看手册。

2、挂载回环设备到特定目录，我们假设要挂载到/mnt/下面。
`mount /dev/loop0  /mnt/`
这样/mnt/下面就是a.iso的内容了。可以通过shell去访问它了。

3、用完之后，需要卸载回环设备。
`umount /mnt/`
这样设备就卸载，/mnt/下面就不是a.iso的文件了。

4、回环设备和关联文件分离。虽然已经在系统中卸载了回环设备，但是这个设备和文件的关联还存在。假如你还要用这个设备关联其他的文件，系统会提示这个设备正在忙。所以需要让回环设备和关联文件分离。
`losetup -d /dev/loop0`
这样一个光盘镜像的使用就完成了。当然同理也可以通过回环设备挂载其他的虚拟文件，比如虚拟软盘img等。

#### 挂载光盘/DVD 映象文件

下载了 Linux 或者是其他所需光盘/DVD 的映象文件后， 不需要刻录成光盘才能够使用该文件里面的数据，可以通过 loop 设备挂载

```shell
[root@study ~]# ll -h /tmp/CentOS-7.0-1406-x86_64-DVD.iso
-rw-r--r--. 1 root root 3.9G Jul 7 2014 /tmp/CentOS-7.0-1406-x86_64-DVD.iso
# 看到上面的结果吧！这个文件就是映象档，文件非常的大吧！
[root@study ~]# mkdir /data/centos_dvd
[root@study ~]# mount -o loop /tmp/CentOS-7.0-1406-x86_64-DVD.iso /data/centos_dvd
[root@study ~]# df /data/centos_dvd
Filesystem 1K-blocks Used Available Use% Mounted on
/dev/loop0 4050860 4050860 0 100% /data/centos_dvd
# 就是这个项目！ .iso 映象文件内的所有数据可以在 /data/centos_dvd 看到！
[root@study ~]# ll /data/centos_dvd
total 607
-rw-r--r--. 1 500 502 14 Jul 5 2014 CentOS_BuildTag <==瞧！就是 DVD 的内容啊！
drwxr-xr-x. 3 500 502 2048 Jul 4 2014 EFI
-rw-r--r--. 1 500 502 611 Jul 5 2014 EULA
-rw-r--r--. 1 500 502 18009 Jul 5 2014 GPL
drwxr-xr-x. 3 500 502 2048 Jul 4 2014 images
.....(底下省略).....
[root@study ~]# umount /data/centos_dvd/
# 测试完成！记得将数据给他卸除！同时这个映像档也被鸟哥删除了...测试机容量不够大！
```